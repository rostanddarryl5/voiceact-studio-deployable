from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import parselmouth
from faster_whisper.audio import decode_audio

from .schemas import AcousticFrameResponse, AcousticMetricsResponse

SAMPLE_RATE = 16_000
FRAME_STEP_SECONDS = 0.01
PITCH_FLOOR_HZ = 65.0
PITCH_CEILING_HZ = 500.0


def _finite_percentile(values: np.ndarray, percentile: float) -> float | None:
    clean = values[np.isfinite(values)]
    if clean.size == 0:
        return None
    return float(np.percentile(clean, percentile))


def _value_at_time(sampled: parselmouth.Sampled, time: float) -> float | None:
    value = float(sampled.get_value(time))
    return value if math.isfinite(value) and value > -100 else None


def analyze_acoustics(path: Path) -> AcousticMetricsResponse:
    """Measure observable prosody; this deliberately does not infer an emotion label."""
    samples = np.asarray(decode_audio(str(path), sampling_rate=SAMPLE_RATE), dtype=np.float64)
    if samples.size < SAMPLE_RATE // 5:
        raise ValueError("Audio trop court pour une analyse acoustique fiable.")

    sound = parselmouth.Sound(samples, sampling_frequency=SAMPLE_RATE)
    pitch = sound.to_pitch_ac(
        time_step=FRAME_STEP_SECONDS,
        pitch_floor=PITCH_FLOOR_HZ,
        pitch_ceiling=PITCH_CEILING_HZ,
        very_accurate=True,
    )
    intensity = sound.to_intensity(
        minimum_pitch=PITCH_FLOOR_HZ,
        time_step=FRAME_STEP_SECONDS,
        subtract_mean=True,
    )
    harmonicity = sound.to_harmonicity_cc(
        time_step=FRAME_STEP_SECONDS,
        minimum_pitch=PITCH_FLOOR_HZ,
        silence_threshold=0.1,
        periods_per_window=4.5,
    )

    pitch_values = np.asarray(pitch.selected_array["frequency"], dtype=np.float64)
    voiced_values = pitch_values[(pitch_values > 0) & np.isfinite(pitch_values)]
    pitch_median = _finite_percentile(voiced_values, 50)
    pitch_p10 = _finite_percentile(voiced_values, 10)
    pitch_p90 = _finite_percentile(voiced_values, 90)
    pitch_range = 0.0
    if pitch_p10 and pitch_p90 and pitch_p90 > pitch_p10:
        pitch_range = 12 * math.log2(pitch_p90 / pitch_p10)

    # Intensity in silent frames tends toward Praat's numerical floor. Dynamic
    # range must therefore be calculated only where a periodic voice is present.
    voiced_intensity_values = np.asarray(
        [
            value
            for index, time in enumerate(pitch.xs())
            if pitch_values[index] > 0 and (value := _value_at_time(intensity, float(time))) is not None
        ],
        dtype=np.float64,
    )
    intensity_p10 = _finite_percentile(voiced_intensity_values, 10)
    intensity_p90 = _finite_percentile(voiced_intensity_values, 90)
    intensity_range = max(0.0, (intensity_p90 or 0.0) - (intensity_p10 or 0.0))

    harmonicity_values = np.asarray(harmonicity.values, dtype=np.float64).reshape(-1)
    usable_hnr = harmonicity_values[np.isfinite(harmonicity_values) & (harmonicity_values > -100)]
    hnr_mean = float(np.mean(usable_hnr)) if usable_hnr.size else None

    duration = float(sound.duration)
    frames: list[AcousticFrameResponse] = []
    frame_count = max(1, math.floor(duration / FRAME_STEP_SECONDS) + 1)
    for index in range(frame_count):
        time = min(duration, index * FRAME_STEP_SECONDS)
        pitch_hz = float(pitch.get_value_at_time(time))
        if not math.isfinite(pitch_hz) or pitch_hz <= 0:
            pitch_hz = None
        frames.append(
            AcousticFrameResponse(
                time=round(time, 4),
                pitchHz=round(pitch_hz, 3) if pitch_hz is not None else None,
                intensityDb=_value_at_time(intensity, time),
            )
        )

    voiced_ratio = len(voiced_values) / max(1, len(pitch_values))
    quality = "high" if len(voiced_values) >= 30 and voiced_ratio >= 0.2 else "limited"
    return AcousticMetricsResponse(
        source="praat-parselmouth",
        quality=quality,
        sampleRate=SAMPLE_RATE,
        frameStepMs=round(FRAME_STEP_SECONDS * 1_000),
        pitchMedianHz=pitch_median,
        pitchP10Hz=pitch_p10,
        pitchP90Hz=pitch_p90,
        pitchRangeSemitones=pitch_range,
        voicedRatio=voiced_ratio,
        intensityMeanDb=float(np.mean(voiced_intensity_values)) if voiced_intensity_values.size else None,
        intensityRangeDb=intensity_range,
        hnrMeanDb=hnr_mean,
        frames=frames,
    )
