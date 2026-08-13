import type {
  AcousticFrame,
  AudioMetrics,
  DetailedAudioMetrics,
  ServerAcousticAnalysis,
  SpeechInterval,
} from "./types";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function getPreferredRecorderOptions() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

function dbfs(rms: number) {
  return 20 * Math.log10(Math.max(rms, 1e-7));
}

function semitoneDistance(low: number, high: number) {
  if (low <= 0 || high <= 0) return 0;
  return 12 * Math.log2(high / low);
}

function estimatePitch(
  samples: Float32Array,
  sampleRate: number,
  start: number,
  end: number,
): { hz: number | null; confidence: number } {
  const step = Math.max(1, Math.floor(sampleRate / 8_000));
  const downsampledRate = sampleRate / step;
  const length = Math.max(0, Math.floor((end - start) / step));
  if (length < 64) return { hz: null, confidence: 0 };

  const frame = new Float32Array(length);
  let mean = 0;
  for (let index = 0; index < length; index += 1) {
    const value = samples[start + index * step] ?? 0;
    frame[index] = value;
    mean += value;
  }
  mean /= length;

  for (let index = 0; index < length; index += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / Math.max(1, length - 1));
    frame[index] = ((frame[index] ?? 0) - mean) * window;
  }

  const minLag = Math.max(2, Math.floor(downsampledRate / 500));
  const maxLag = Math.min(length - 3, Math.ceil(downsampledRate / 65));
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let numerator = 0;
    let energyA = 0;
    let energyB = 0;
    for (let index = 0; index < length - lag; index += 1) {
      const a = frame[index] ?? 0;
      const b = frame[index + lag] ?? 0;
      numerator += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const correlation = numerator / Math.sqrt(Math.max(1e-12, energyA * energyB));
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (!bestLag || bestCorrelation < 0.58) return { hz: null, confidence: bestCorrelation };
  return { hz: downsampledRate / bestLag, confidence: bestCorrelation };
}

function intervalsFromMask(mask: boolean[], hopSeconds: number, frameSeconds: number): SpeechInterval[] {
  const raw: SpeechInterval[] = [];
  let startIndex: number | null = null;

  for (let index = 0; index <= mask.length; index += 1) {
    if (mask[index] && startIndex === null) startIndex = index;
    if ((!mask[index] || index === mask.length) && startIndex !== null) {
      const start = startIndex * hopSeconds;
      const end = Math.min(index * hopSeconds + frameSeconds, mask.length * hopSeconds + frameSeconds);
      raw.push({ start, end, duration: end - start });
      startIndex = null;
    }
  }

  const merged: SpeechInterval[] = [];
  for (const interval of raw) {
    const previous = merged.at(-1);
    if (previous && interval.start - previous.end <= 0.12) {
      previous.end = interval.end;
      previous.duration = previous.end - previous.start;
    } else {
      merged.push({ ...interval });
    }
  }
  return merged.filter((interval) => interval.duration >= 0.08);
}

async function decodeMono(blob: Blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("AudioContext unavailable");

  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = new Float32Array(audioBuffer.length);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) mono[index] += (data[index] ?? 0) / audioBuffer.numberOfChannels;
    }
    return { mono, sampleRate: audioBuffer.sampleRate, duration: audioBuffer.duration };
  } finally {
    await audioContext.close();
  }
}

export async function analyzeAudioBlobDetailed(blob: Blob): Promise<DetailedAudioMetrics> {
  const { mono, sampleRate, duration } = await decodeMono(blob);
  const frameSeconds = 0.04;
  const hopSeconds = 0.01;
  const frameSize = Math.max(1, Math.floor(sampleRate * frameSeconds));
  const hopSize = Math.max(1, Math.floor(sampleRate * hopSeconds));
  const rawFrames: Array<Omit<AcousticFrame, "pitchHz" | "pitchConfidence" | "isSpeech">> = [];
  let sumSquares = 0;
  let peak = 0;
  let clippedSamples = 0;

  for (let index = 0; index < mono.length; index += 1) {
    const sample = mono[index] ?? 0;
    const absolute = Math.abs(sample);
    sumSquares += sample * sample;
    peak = Math.max(peak, absolute);
    if (absolute >= 0.985) clippedSamples += 1;
  }

  for (let start = 0; start < mono.length; start += hopSize) {
    const end = Math.min(mono.length, start + frameSize);
    let frameSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = mono[index] ?? 0;
      frameSquares += sample * sample;
    }
    const rms = Math.sqrt(frameSquares / Math.max(1, end - start));
    rawFrames.push({ start: start / sampleRate, end: end / sampleRate, rms, dbfs: dbfs(rms) });
  }

  const frameLevels = rawFrames.map((frame) => frame.dbfs);
  const noiseFloorDbfs = Math.min(percentile(frameLevels, 0.2), percentile(frameLevels, 0.5) - 10);
  const speechThresholdDbfs = Math.min(Math.max(noiseFloorDbfs + 9, -45), percentile(frameLevels, 0.5) - 5);
  const initialMask = rawFrames.map((frame) => frame.dbfs >= speechThresholdDbfs);
  const speechIntervals = intervalsFromMask(initialMask, hopSeconds, frameSeconds);
  const isSpeechAt = (time: number) => speechIntervals.some((interval) => time >= interval.start && time <= interval.end);

  const frames: AcousticFrame[] = rawFrames.map((frame, index) => {
    const isSpeech = isSpeechAt((frame.start + frame.end) / 2);
    if (!isSpeech || index % 2 === 1) {
      return { ...frame, pitchHz: null, pitchConfidence: 0, isSpeech };
    }
    const pitch = estimatePitch(mono, sampleRate, Math.floor(frame.start * sampleRate), Math.floor(frame.end * sampleRate));
    return { ...frame, pitchHz: pitch.hz, pitchConfidence: pitch.confidence, isSpeech };
  });

  const speechFrames = frames.filter((frame) => frame.isSpeech);
  const pitchedFrames = speechFrames.filter((frame) => frame.pitchHz !== null && frame.pitchConfidence >= 0.58);
  const pitchValues = pitchedFrames.map((frame) => frame.pitchHz as number);
  const medianPitchHz = pitchValues.length ? percentile(pitchValues, 0.5) : null;
  const pitchRangeSemitones = pitchValues.length >= 4 ? semitoneDistance(percentile(pitchValues, 0.1), percentile(pitchValues, 0.9)) : 0;
  const pauses = speechIntervals.slice(0, -1).map((interval, index) => {
    const next = speechIntervals[index + 1];
    return { start: interval.end, end: next.start, durationMs: Math.max(0, (next.start - interval.end) * 1_000) };
  });
  const speechDuration = speechIntervals.reduce((sum, interval) => sum + interval.duration, 0);
  const rms = Math.sqrt(sumSquares / Math.max(1, mono.length));
  const speechRmsValues = speechFrames.map((frame) => frame.rms);
  const speechRmsMean = average(speechRmsValues);

  return {
    rms,
    peak,
    silenceRatio: duration > 0 ? Math.max(0, 1 - speechDuration / duration) : 1,
    pauseCount: pauses.filter((pause) => pause.durationMs >= 180).length,
    energyVariation: speechRmsMean > 0 ? standardDeviation(speechRmsValues) / speechRmsMean : 0,
    duration,
    sampleRate,
    noiseFloorDbfs,
    speechRatio: duration > 0 ? Math.min(1, speechDuration / duration) : 0,
    clippingRatio: clippedSamples / Math.max(1, mono.length),
    medianSpeechDbfs: percentile(speechFrames.map((frame) => frame.dbfs), 0.5),
    medianPitchHz,
    pitchRangeSemitones,
    voicedRatio: speechFrames.length ? pitchedFrames.length / Math.ceil(speechFrames.length / 2) : 0,
    frames,
    speechIntervals,
    pauses,
  };
}

export async function analyzeAudioBlob(blob: Blob): Promise<AudioMetrics> {
  const detailed = await analyzeAudioBlobDetailed(blob);
  return {
    rms: detailed.rms,
    peak: detailed.peak,
    silenceRatio: detailed.silenceRatio,
    pauseCount: detailed.pauseCount,
    energyVariation: detailed.energyVariation,
    duration: detailed.duration,
  };
}

export function mergeServerAcoustics(
  metrics: DetailedAudioMetrics,
  acoustics: ServerAcousticAnalysis | undefined,
): DetailedAudioMetrics {
  if (!acoustics || acoustics.source !== "praat-parselmouth" || acoustics.frames.length === 0) return metrics;

  const stepSeconds = acoustics.frameStepMs / 1_000;
  const frames = metrics.frames.map((frame) => {
    const midpoint = (frame.start + frame.end) / 2;
    const serverIndex = Math.min(
      acoustics.frames.length - 1,
      Math.max(0, Math.round(midpoint / Math.max(0.001, stepSeconds))),
    );
    const serverFrame = acoustics.frames[serverIndex];
    const pitchHz = serverFrame?.pitchHz ?? null;
    return {
      ...frame,
      pitchHz,
      pitchConfidence: pitchHz === null ? 0 : 0.98,
    };
  });

  return {
    ...metrics,
    medianPitchHz: acoustics.pitchMedianHz,
    pitchRangeSemitones: acoustics.pitchRangeSemitones,
    voicedRatio: acoustics.voicedRatio,
    acousticSource: acoustics.source,
    acousticQuality: acoustics.quality,
    intensityRangeDb: acoustics.intensityRangeDb,
    hnrMeanDb: acoustics.hnrMeanDb,
    frames,
  };
}

export function scoreAudio(metrics: AudioMetrics, expectedPauses: number) {
  const pauseGap = Math.abs(metrics.pauseCount - expectedPauses);
  const pauseScore = clampScore(100 - pauseGap * 18 - Math.max(0, metrics.silenceRatio - 0.45) * 80);
  const volumeScore = metrics.rms < 0.012 ? 45 : metrics.rms > 0.18 ? 65 : 90;
  const peakScore = metrics.peak > 0.96 ? 55 : 90;
  const variationScore = metrics.energyVariation < 0.25 ? 55 : metrics.energyVariation > 1.5 ? 65 : 88;

  return clampScore(volumeScore * 0.22 + peakScore * 0.18 + pauseScore * 0.34 + variationScore * 0.26);
}
