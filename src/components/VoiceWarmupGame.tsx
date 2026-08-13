"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dailyWarmupModel, isWarmupCalibrationReady, scoreWarmupMeasurement } from "@/lib/warmup-exercise-model";

export type WarmupDailyResult = {
  date: string;
  score: number | null;
  accuracy: number;
  smoothness: number;
  continuity: number;
  timing: number;
  reliable: boolean;
  completedAt: string;
};

type WarmupStage = "intro" | "calibration" | "ready" | "countdown" | "playing" | "result" | "rest" | "error";
type VoiceState = "available" | "fatigued";
type VoiceCommand = "up" | "down" | "center";
type VoiceFeatures = {
  centroid: number;
  lowRatio: number;
  midRatio: number;
};

type Cue = {
  start: number;
  end: number;
  from: number;
  to: number;
  command?: VoiceCommand;
  label: string;
  hint: string;
  rest?: boolean;
};

type Ring = {
  id: string;
  time: number;
  semitones: number;
};

type HitFx = {
  id: number;
  ringId: string;
  quality: "perfect" | "good";
  x: number;
  y: number;
};

const FULL_DURATION = dailyWarmupModel.durations.available;
const FATIGUED_DURATION = dailyWarmupModel.durations.fatigued;
const LOOK_AHEAD_SECONDS = 6.2;
const PLAYER_X_PERCENT = 21;
const VOICE_CONFIDENCE = 0.52;
const RING_SCORE_WINDOW_SECONDS = 0.92;
const RING_PASS_GRACE_SECONDS = 0.36;
const RING_HIT_TOLERANCE = 2.15;
const RING_PERFECT_TOLERANCE = 0.78;

const cues: Cue[] = [
  { start: 0, end: 4, from: 0, to: 0, command: "center", label: "Aaaaaaa ◎", hint: "Garde Voxi au milieu." },
  { start: 4, end: 8, from: 0, to: 2.5, command: "up", label: "Mmmmmmm ↗", hint: "Monte. Une voix plus haute donne plus d'élan." },
  { start: 8, end: 12, from: 2.5, to: 0, command: "center", label: "Aaaaaaa ◎", hint: "Ramène Voxi doucement au milieu." },
  { start: 12, end: 16, from: 0, to: -2.5, command: "down", label: "Ouuuuuuu ↘", hint: "Descends. Une voix plus basse accentue la chute." },
  { start: 16, end: 20, from: -2.5, to: 0, label: "Respire", hint: "Voxi plane. Relâche les épaules.", rest: true },
  { start: 20, end: 24, from: -1, to: 3, command: "up", label: "Mmmmmmm ↗", hint: "Fais remonter Voxi sans pousser le volume." },
  { start: 24, end: 28, from: 3, to: 0, command: "center", label: "Aaaaaaa ◎", hint: "Recentre la trajectoire." },
  { start: 28, end: 32, from: 0, to: -3, command: "down", label: "Ouuuuuuu ↘", hint: "Descends de façon continue et confortable." },
  { start: 32, end: 36, from: -3, to: 0, label: "Respire", hint: "Laisse la voix se reposer.", rest: true },
  { start: 36, end: 40, from: 0, to: 2, command: "up", label: "Mmmmmmm ↗", hint: "Monte en gardant le même volume." },
  { start: 40, end: 44, from: 2, to: -2, command: "down", label: "Ouuuuuuu ↘", hint: "Traverse le milieu puis poursuis vers le bas." },
  { start: 44, end: 48, from: -2, to: 0, command: "center", label: "Aaaaaaa ◎", hint: "Termine exactement au centre." },
];

const calibrationSteps: Array<{ command: VoiceCommand; label: string; hint: string }> = [
  { command: "up", label: "Mmmmmmm", hint: "Bouche fermée, son doux : c'est la commande pour monter." },
  { command: "down", label: "Ouuuuuuu", hint: "Lèvres arrondies : c'est la commande pour descendre." },
  { command: "center", label: "Aaaaaaa", hint: "Bouche ouverte, sans forcer : c'est la commande pour revenir au milieu." },
];

const rings: Ring[] = [
  { id: "r1", time: 3, semitones: 0 },
  { id: "r2", time: 7, semitones: 2.5 },
  { id: "r3", time: 11, semitones: 0 },
  { id: "r4", time: 15, semitones: -2.5 },
  { id: "r5", time: 23, semitones: 3 },
  { id: "r6", time: 27, semitones: 0 },
  { id: "r7", time: 31, semitones: -3 },
  { id: "r8", time: 39, semitones: 2 },
  { id: "r9", time: 43, semitones: -2 },
  { id: "r10", time: 47, semitones: 0 },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cueAt(seconds: number) {
  return cues.find((cue) => seconds >= cue.start && seconds < cue.end) ?? cues[cues.length - 1];
}

function cueTarget(cue: Cue, seconds: number) {
  const progress = clamp((seconds - cue.start) / Math.max(0.001, cue.end - cue.start), 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  return cue.from + (cue.to - cue.from) * eased;
}

function commandLabel(command: VoiceCommand | null) {
  if (command === "up") return "Mmmm détecté";
  if (command === "down") return "Ouuu détecté";
  if (command === "center") return "Aaaa détecté";
  return "Je t'écoute";
}

function pitchFromSamples(samples: Float32Array, sampleRate: number, previousHz: number | null) {
  let energy = 0;
  let mean = 0;
  for (let index = 0; index < samples.length; index += 1) mean += samples[index];
  mean /= samples.length;

  for (let index = 0; index < samples.length; index += 1) {
    const centered = samples[index] - mean;
    energy += centered * centered;
  }
  const rms = Math.sqrt(energy / samples.length);
  if (rms < 0.009) return { hz: null, confidence: 0, rms };

  const minHz = 70;
  const maxHz = 650;
  const minOffset = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxOffset = Math.min(Math.floor(sampleRate / minHz), Math.floor(samples.length * 0.72));
  let bestOffset = 0;
  let bestCorrelation = 0;

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    const limit = samples.length - offset;
    for (let index = 0; index < limit; index += 2) {
      const left = samples[index] - mean;
      const right = samples[index + offset] - mean;
      correlation += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const normalized = correlation / Math.sqrt(Math.max(1e-9, leftEnergy * rightEnergy));
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestOffset = offset;
    }
  }

  if (!bestOffset || bestCorrelation < VOICE_CONFIDENCE) return { hz: null, confidence: bestCorrelation, rms };
  let hz = sampleRate / bestOffset;
  if (previousHz) {
    while (hz > previousHz * 1.78) hz /= 2;
    while (hz < previousHz * 0.56 && hz * 2 <= maxHz) hz *= 2;
  }
  if (hz < minHz || hz > maxHz) return { hz: null, confidence: bestCorrelation, rms };
  return { hz, confidence: bestCorrelation, rms };
}

function spectrumFeatures(spectrum: Uint8Array, sampleRate: number, fftSize: number): VoiceFeatures | null {
  const binHz = sampleRate / fftSize;
  let energy = 0;
  let weightedFrequency = 0;
  let lowEnergy = 0;
  let midEnergy = 0;

  for (let index = 1; index < spectrum.length; index += 1) {
    const frequency = index * binHz;
    if (frequency > 4000) break;
    const normalized = (spectrum[index] ?? 0) / 255;
    const magnitude = normalized * normalized;
    energy += magnitude;
    weightedFrequency += magnitude * frequency;
    if (frequency < 650) lowEnergy += magnitude;
    else if (frequency < 1700) midEnergy += magnitude;
  }

  if (energy < 0.08) return null;
  return {
    centroid: weightedFrequency / energy,
    lowRatio: lowEnergy / energy,
    midRatio: midEnergy / energy,
  };
}

function averageFeatures(samples: VoiceFeatures[]): VoiceFeatures | null {
  if (!samples.length) return null;
  const total = samples.reduce(
    (sum, item) => ({
      centroid: sum.centroid + item.centroid,
      lowRatio: sum.lowRatio + item.lowRatio,
      midRatio: sum.midRatio + item.midRatio,
    }),
    { centroid: 0, lowRatio: 0, midRatio: 0 },
  );
  return {
    centroid: total.centroid / samples.length,
    lowRatio: total.lowRatio / samples.length,
    midRatio: total.midRatio / samples.length,
  };
}

function classifyCommand(
  features: VoiceFeatures,
  profiles: Record<VoiceCommand, VoiceFeatures | null>,
): VoiceCommand | null {
  const distances = (Object.keys(profiles) as VoiceCommand[])
    .map((command) => {
      const profile = profiles[command];
      if (!profile) return { command, distance: Number.POSITIVE_INFINITY };
      const distance =
        Math.abs(features.centroid - profile.centroid) / 950
        + Math.abs(features.lowRatio - profile.lowRatio) / 0.32
        + Math.abs(features.midRatio - profile.midRatio) / 0.32;
      return { command, distance };
    })
    .sort((left, right) => left.distance - right.distance);

  const best = distances[0];
  if (!best || !Number.isFinite(best.distance) || best.distance > 1.9) return null;
  return best.command;
}

function feedbackFor(result: WarmupDailyResult) {
  if (!result.reliable) return "Je n'ai pas reçu assez de voix claire pour donner une note honnête.";
  if ((result.score ?? 0) >= 88) return "Très belle courbe : souple, précise et régulière.";
  if (result.accuracy < result.smoothness) return "Tu suis bien le mouvement. Vise maintenant le centre des cerceaux.";
  if (result.smoothness < 68) return "Monte moins vite : une courbe douce vaut mieux qu'un grand saut.";
  if (result.continuity < 70) return "Garde le son relié entre deux cerceaux, sans ajouter de volume.";
  return "Ta voix est réveillée. La prochaine prise sera encore plus fluide.";
}

export default function VoiceWarmupGame({
  previousResult,
  onComplete,
  onContinue,
}: {
  previousResult: WarmupDailyResult | null;
  onComplete: (result: WarmupDailyResult) => void;
  onContinue: () => void;
}) {
  const [stage, setStage] = useState<WarmupStage>("intro");
  const [introGuideStep, setIntroGuideStep] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("available");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [currentSemitones, setCurrentSemitones] = useState(0);
  const [pitchConfidence, setPitchConfidence] = useState(0);
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommand | null>(null);
  const [liveLevel, setLiveLevel] = useState(0);
  const [ringOutcomes, setRingOutcomes] = useState<Record<string, "hit" | "miss">>({});
  const [hitFx, setHitFx] = useState<HitFx | null>(null);
  const [result, setResult] = useState<WarmupDailyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const stageRef = useRef<WarmupStage>("intro");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioFrameRef = useRef<number | null>(null);
  const gameFrameRef = useRef<number | null>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const baselineHzRef = useRef(0);
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationStartedAtRef = useRef(0);
  const calibrationFeaturesRef = useRef<Record<VoiceCommand, VoiceFeatures[]>>({
    up: [],
    down: [],
    center: [],
  });
  const commandProfilesRef = useRef<Record<VoiceCommand, VoiceFeatures | null>>({
    up: null,
    down: null,
    center: null,
  });
  const detectedCommandRef = useRef<VoiceCommand | null>(null);
  const commandCandidateRef = useRef<VoiceCommand | null>(null);
  const commandCandidateFramesRef = useRef(0);
  const unvoicedFramesRef = useRef(0);
  const previousHzRef = useRef<number | null>(null);
  const currentSemitoneRef = useRef(0);
  const pitchConfidenceRef = useRef(0);
  const gameStartedAtRef = useRef(0);
  const lastPitchTickRef = useRef(0);
  const lastUiTickRef = useRef(0);
  const voicedFramesRef = useRef(0);
  const activeFramesRef = useRef(0);
  const suddenJumpsRef = useRef(0);
  const lastScoredSemitoneRef = useRef<number | null>(null);
  const ringBestErrorRef = useRef(new Map<string, number>());
  const ringBestSampleRef = useRef(new Map<string, { error: number; x: number; y: number }>());
  const ringOutcomeRef = useRef<Record<string, "hit" | "miss">>({});
  const hitFxCounterRef = useRef(0);
  const finishedRef = useRef(false);
  const demoModeRef = useRef(false);

  const duration = voiceState === "fatigued" ? FATIGUED_DURATION : FULL_DURATION;
  const activeRings = useMemo(() => rings.filter((ring) => ring.time <= duration), [duration]);
  const currentCue = cueAt(elapsed);
  const mascotTop = clamp(50 - currentSemitones * 8.2, 16, 84);
  const calibrationStep = calibrationSteps[Math.min(calibrationSteps.length - 1, Math.floor(calibrationProgress * calibrationSteps.length))];

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const stopAudio = useCallback(() => {
    if (audioFrameRef.current) window.cancelAnimationFrame(audioFrameRef.current);
    audioFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => {
    stopAudio();
    if (gameFrameRef.current) window.cancelAnimationFrame(gameFrameRef.current);
    if (calibrationTimerRef.current) window.clearTimeout(calibrationTimerRef.current);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
  }, [stopAudio]);

  const runPitchLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !audioContext) return;
    const samples = new Float32Array(analyser.fftSize);
    const frequencySamples = new Uint8Array(analyser.frequencyBinCount);

    const tick = (now: number) => {
      if (!analyserRef.current || !audioContextRef.current) return;
      if (now - lastPitchTickRef.current >= 15) {
        lastPitchTickRef.current = now;
        analyser.getFloatTimeDomainData(samples);
        analyser.getByteFrequencyData(frequencySamples);
        const detected = pitchFromSamples(samples, audioContext.sampleRate, previousHzRef.current);
        const features = detected.rms >= 0.009
          ? spectrumFeatures(frequencySamples, audioContext.sampleRate, analyser.fftSize)
          : null;
        setLiveLevel(clamp(Math.round(detected.rms * 520), 0, 100));
        pitchConfidenceRef.current = detected.confidence;
        setPitchConfidence(detected.confidence);

        if (detected.hz) {
          unvoicedFramesRef.current = 0;
          previousHzRef.current = detected.hz;
          if (stageRef.current === "calibration" && calibrationStartedAtRef.current > 0) {
            const calibrationElapsed = performance.now() - calibrationStartedAtRef.current;
            const stepIndex = Math.min(calibrationSteps.length - 1, Math.floor(calibrationElapsed / 2000));
            const command = calibrationSteps[stepIndex]?.command ?? "up";
            if (command === "up") calibrationSamplesRef.current.push(detected.hz);
            if (features) calibrationFeaturesRef.current[command].push(features);
          }

          if (stageRef.current === "playing" && baselineHzRef.current > 0 && features) {
            const candidate = classifyCommand(features, commandProfilesRef.current);
            if (candidate === commandCandidateRef.current) {
              commandCandidateFramesRef.current += 1;
            } else {
              commandCandidateRef.current = candidate;
              commandCandidateFramesRef.current = 1;
            }
            const commandSwitchFrames = candidate && detected.confidence >= 0.66 ? 1 : 2;
            if (commandCandidateFramesRef.current >= commandSwitchFrames && candidate !== detectedCommandRef.current) {
              detectedCommandRef.current = candidate;
              setDetectedCommand(candidate);
            }

            const gameElapsed = (performance.now() - gameStartedAtRef.current) / 1000;
            const cue = cueAt(gameElapsed);
            const effectiveCommand = detectedCommandRef.current ?? (detected.confidence >= 0.7 ? cue.command ?? null : null);
            if (!cue.rest && effectiveCommand) {
              const relativePitch = clamp(12 * Math.log2(detected.hz / baselineHzRef.current), -4, 4);
              let nextPosition = currentSemitoneRef.current;
              const assistMultiplier = detectedCommandRef.current ? 1 : 0.58;
              if (effectiveCommand === "up") {
                nextPosition += (0.035 + Math.max(0, relativePitch) * 0.012) * assistMultiplier;
              } else if (effectiveCommand === "down") {
                nextPosition -= (0.035 + Math.max(0, -relativePitch) * 0.012) * assistMultiplier;
              } else {
                const centerStrength = 0.1 + Math.max(0, 1 - Math.abs(relativePitch) / 4) * 0.05;
                nextPosition += (0 - nextPosition) * centerStrength * assistMultiplier;
              }
              currentSemitoneRef.current = clamp(nextPosition, -4.2, 4.2);
              setCurrentSemitones(currentSemitoneRef.current);
            }
          }
        } else {
          unvoicedFramesRef.current += 1;
          if (unvoicedFramesRef.current >= 4 && detectedCommandRef.current !== null) {
            detectedCommandRef.current = null;
            commandCandidateRef.current = null;
            commandCandidateFramesRef.current = 0;
            setDetectedCommand(null);
          }
        }
      }
      audioFrameRef.current = window.requestAnimationFrame(tick);
    };
    audioFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const openAudioCapture = useCallback(async () => {
    if (demoModeRef.current || analyserRef.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Ce navigateur ne permet pas d'utiliser le micro.");
      setStage("error");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext indisponible");
      const audioContext = window.AudioContext
        ? new window.AudioContext({ latencyHint: "interactive" })
        : new AudioContextClass();
      await audioContext.resume();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      lastPitchTickRef.current = 0;
      runPitchLoop();
      return true;
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setErrorMessage(denied
        ? "Le micro est bloqué. Autorise-le dans la barre d'adresse, puis réessaie."
        : "Je n'arrive pas à écouter ta voix. Vérifie ton micro puis réessaie.");
      setStage("error");
      stopAudio();
      return false;
    }
  }, [runPitchLoop, stopAudio]);

  const beginCalibration = useCallback(async () => {
    setErrorMessage("");
    setCalibrationProgress(0);
    setStage("calibration");
    calibrationSamplesRef.current = [];
    calibrationStartedAtRef.current = 0;
    calibrationFeaturesRef.current = { up: [], down: [], center: [] };
    commandProfilesRef.current = { up: null, down: null, center: null };
    detectedCommandRef.current = null;
    setDetectedCommand(null);
    previousHzRef.current = null;
    pitchConfidenceRef.current = 0;
    stopAudio();

    demoModeRef.current = process.env.NODE_ENV !== "production"
      && new URLSearchParams(window.location.search).has("warmupDemo");
    if (demoModeRef.current) {
      calibrationSamplesRef.current = Array.from({ length: 40 }, (_, index) => 164 + Math.sin(index * 0.3) * 2);
      commandProfilesRef.current = {
        up: { centroid: 620, lowRatio: 0.7, midRatio: 0.2 },
        down: { centroid: 920, lowRatio: 0.52, midRatio: 0.34 },
        center: { centroid: 1420, lowRatio: 0.3, midRatio: 0.5 },
      };
    } else {
      const audioReady = await openAudioCapture();
      if (!audioReady) return;
    }

    const startedAt = performance.now();
    calibrationStartedAtRef.current = startedAt;
    const progressTick = window.setInterval(() => {
      setCalibrationProgress(clamp((performance.now() - startedAt) / 6000, 0, 1));
    }, 60);
    calibrationTimerRef.current = window.setTimeout(() => {
      window.clearInterval(progressTick);
      const usable = calibrationSamplesRef.current.filter((hz) => hz >= 70 && hz <= 650);
      const learnedProfiles: Record<VoiceCommand, VoiceFeatures | null> = demoModeRef.current
        ? commandProfilesRef.current
        : {
            up: averageFeatures(calibrationFeaturesRef.current.up),
            down: averageFeatures(calibrationFeaturesRef.current.down),
            center: averageFeatures(calibrationFeaturesRef.current.center),
          };
      const profilesReady = Object.values(learnedProfiles).every(Boolean);
      if (!isWarmupCalibrationReady(usable.length, Object.values(learnedProfiles).filter(Boolean).length) || !profilesReady) {
        setErrorMessage("Je n'ai pas distingué les trois sons. Prononce chacun pendant deux secondes, près du micro.");
        setStage("error");
        stopAudio();
        return;
      }
      commandProfilesRef.current = learnedProfiles;
      baselineHzRef.current = median(usable);
      currentSemitoneRef.current = 0;
      setCurrentSemitones(0);
      setCalibrationProgress(1);
      setStage("ready");
    }, 6000);
  }, [openAudioCapture, stopAudio]);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (gameFrameRef.current) window.cancelAnimationFrame(gameFrameRef.current);

    const warmupScore = scoreWarmupMeasurement({
      ringCount: activeRings.length,
      ringHits: activeRings.filter((ring) => ringOutcomeRef.current[ring.id] === "hit").length,
      ringErrors: activeRings
        .map((ring) => ringBestErrorRef.current.get(ring.id))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      activeFrames: activeFramesRef.current,
      voicedFrames: voicedFramesRef.current,
      suddenJumps: suddenJumpsRef.current,
    });
    const nextResult: WarmupDailyResult = {
      date: localDateKey(),
      score: warmupScore.score,
      accuracy: warmupScore.accuracy,
      smoothness: warmupScore.smoothness,
      continuity: warmupScore.continuity,
      timing: warmupScore.timing,
      reliable: warmupScore.reliable,
      completedAt: new Date().toISOString(),
    };
    setResult(nextResult);
    onComplete(nextResult);
    setStage("result");
    stopAudio();
  }, [activeRings, onComplete, stopAudio]);

  const startGame = useCallback(async () => {
    const audioReady = await openAudioCapture();
    if (!audioReady) return;
    setStage("countdown");
    setCountdown(3);
    let remaining = 3;
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
        finishedRef.current = false;
        ringBestErrorRef.current = new Map();
        ringBestSampleRef.current = new Map();
        ringOutcomeRef.current = {};
        setRingOutcomes({});
        hitFxCounterRef.current = 0;
        setHitFx(null);
        detectedCommandRef.current = null;
        commandCandidateRef.current = null;
        commandCandidateFramesRef.current = 0;
        setDetectedCommand(null);
        voicedFramesRef.current = 0;
        activeFramesRef.current = 0;
        suddenJumpsRef.current = 0;
        lastScoredSemitoneRef.current = null;
        gameStartedAtRef.current = performance.now();
        lastUiTickRef.current = 0;
        setElapsed(0);
        setStage("playing");
      }
    }, 850);
  }, [openAudioCapture]);

  useEffect(() => {
    if (stage !== "playing") return;
    const render = (now: number) => {
      const nextElapsed = (now - gameStartedAtRef.current) / 1000;
      if (nextElapsed >= duration) {
        setElapsed(duration);
        finishGame();
        return;
      }

      const cue = cueAt(nextElapsed);
      let semitones = currentSemitoneRef.current;
      let voiced = pitchConfidenceRef.current >= VOICE_CONFIDENCE;
      if (demoModeRef.current) {
        semitones = cueTarget(cue, nextElapsed) + Math.sin(nextElapsed * 3.2) * 0.11;
        currentSemitoneRef.current = semitones;
        voiced = !cue.rest;
        pitchConfidenceRef.current = cue.rest ? 0 : 0.92;
        if ((cue.command ?? null) !== detectedCommandRef.current) {
          detectedCommandRef.current = cue.command ?? null;
          setDetectedCommand(cue.command ?? null);
        }
        setPitchConfidence(cue.rest ? 0 : 0.92);
        setLiveLevel(cue.rest ? 0 : 42);
      } else if (cue.rest) {
        semitones += (cueTarget(cue, nextElapsed) - semitones) * 0.045;
        currentSemitoneRef.current = semitones;
      }

      if (!cue.rest) {
        activeFramesRef.current += 1;
        if (voiced) {
          voicedFramesRef.current += 1;
          const previous = lastScoredSemitoneRef.current;
          if (previous !== null && Math.abs(semitones - previous) > 1.15) suddenJumpsRef.current += 1;
          lastScoredSemitoneRef.current = semitones;
        }
      }

      for (const ring of activeRings) {
        const distanceInTime = Math.abs(nextElapsed - ring.time);
        if (distanceInTime <= RING_SCORE_WINDOW_SECONDS && voiced) {
          const error = Math.abs(semitones - ring.semitones);
          const previousBest = ringBestErrorRef.current.get(ring.id) ?? Number.POSITIVE_INFINITY;
          if (error < previousBest) {
            const x = PLAYER_X_PERCENT + ((ring.time - nextElapsed) / LOOK_AHEAD_SECONDS) * (100 - PLAYER_X_PERCENT);
            const y = clamp(50 - ring.semitones * 8.2, 16, 84);
            ringBestErrorRef.current.set(ring.id, error);
            ringBestSampleRef.current.set(ring.id, { error, x: clamp(x, PLAYER_X_PERCENT - 2, PLAYER_X_PERCENT + 12), y });
          }
        }

        if (nextElapsed > ring.time + RING_PASS_GRACE_SECONDS && !ringOutcomeRef.current[ring.id]) {
          const best = ringBestSampleRef.current.get(ring.id);
          if (best && best.error <= RING_HIT_TOLERANCE) {
            const quality = best.error <= RING_PERFECT_TOLERANCE ? "perfect" : "good";
            ringOutcomeRef.current[ring.id] = "hit";
            hitFxCounterRef.current += 1;
            setHitFx({ id: hitFxCounterRef.current, ringId: ring.id, quality, x: best.x, y: best.y });
            navigator.vibrate?.(quality === "perfect" ? [18, 18, 30] : 26);
          } else {
            ringOutcomeRef.current[ring.id] = "miss";
          }
          setRingOutcomes({ ...ringOutcomeRef.current });
        }
      }

      if (now - lastUiTickRef.current >= 32) {
        lastUiTickRef.current = now;
        setElapsed(nextElapsed);
        setCurrentSemitones(semitones);
      }
      gameFrameRef.current = window.requestAnimationFrame(render);
    };
    gameFrameRef.current = window.requestAnimationFrame(render);
    return () => {
      if (gameFrameRef.current) window.cancelAnimationFrame(gameFrameRef.current);
    };
  }, [activeRings, duration, finishGame, stage]);

  function retry() {
    setResult(null);
    setElapsed(0);
    setCurrentSemitones(0);
    currentSemitoneRef.current = 0;
    setRingOutcomes({});
    setHitFx(null);
    setStage("ready");
    void startGame();
  }

  const visibleRings = activeRings.filter(
    (ring) => ring.time >= elapsed - 1.2 && ring.time <= elapsed + LOOK_AHEAD_SECONDS,
  );

  function advanceIntroGuide() {
    setIntroGuideStep((current) => Math.min(3, current + 1));
  }

  return (
    <section className="mx-auto w-full max-w-[1180px]" data-testid="voice-warmup-game">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#17102B] shadow-[0_30px_80px_rgba(5,2,18,0.4)] sm:rounded-[42px]">
        {stage === "intro" ? (
          <div className="grid min-h-[620px] lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative overflow-hidden p-6 sm:p-9 lg:p-12">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(163,230,53,0.16),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.34),transparent_40%)]" />
              <div className="relative">
                <span className="inline-flex rounded-full border border-[#A3E635]/30 bg-[#A3E635]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#BEF264]">
                  Échauffement du jour · 1 min
                </span>
                <h2 className="mt-6 max-w-2xl text-4xl font-black leading-[1.04] sm:text-6xl">
                  Fais voler Voxi avec ta voix.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-[#CFC3EA] sm:text-lg">
                  Trois sons suffisent : « Mmmm » monte, « Ouuu » descend et « Aaaa » recentre Voxi. La hauteur règle seulement la force du mouvement.
                </p>

                <div className="mt-8">
                  <p className="text-sm font-black text-white">Comment se sent ta voix aujourd&apos;hui ?</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <button
                      className={voiceState === "available" ? "warmup-choice is-active" : "warmup-choice"}
                      onClick={() => setVoiceState("available")}
                    >
                      Disponible
                      <span>Parcours normal</span>
                    </button>
                    <button
                      className={voiceState === "fatigued" ? "warmup-choice is-active" : "warmup-choice"}
                      onClick={() => setVoiceState("fatigued")}
                    >
                      Un peu fatiguée
                      <span>Parcours plus court</span>
                    </button>
                    <button className="warmup-choice" onClick={() => setStage("rest")}>
                      Douloureuse
                      <span>Pas de jeu vocal</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button className="warmup-primary-button" onClick={beginCalibration}>
                    Calibrer mon micro
                  </button>
                  <button className="warmup-secondary-button" onClick={onContinue}>
                    Passer pour aujourd&apos;hui
                  </button>
                </div>
                {previousResult?.date === localDateKey() ? (
                  <p className="mt-4 text-sm font-bold text-[#C4B5FD]">
                    Score obtenu aujourd&apos;hui : {previousResult.score === null ? "mesure incomplète" : `${previousResult.score}/100`}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="relative min-h-[360px] overflow-hidden border-t border-white/10 lg:min-h-full lg:border-l lg:border-t-0">
              <Image
                alt="Voxi, la mascotte de VoiceAct"
                className="warmup-hero-voxi object-contain"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 46vw"
                src="/voiceact/warmup/voxi-v2.png"
              />
              <div className="absolute inset-x-8 bottom-8 rounded-[24px] border border-white/15 bg-[#120B25]/65 p-4 text-center backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Règle du vol</p>
                <p className="mt-1 text-sm font-bold">Mmmm ↗ · Ouuu ↘ · Aaaa ◎</p>
              </div>
            </div>
          </div>
        ) : null}

        {stage === "intro" && introGuideStep < 3 ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[#080612]/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Découverte de l'échauffement vocal">
            <div className="w-full max-w-[700px] overflow-hidden rounded-[32px] border border-[#A3E635]/30 bg-[#151126] shadow-[0_28px_100px_rgba(0,0,0,0.55)]">
              <div className="h-2 bg-white/10"><div className="h-full bg-[#A3E635] transition-all duration-500" style={{ width: `${((introGuideStep + 1) / 3) * 100}%` }} /></div>
              <div className="p-5 sm:p-8">
                <div className="grid gap-6 sm:grid-cols-[142px_minmax(0,1fr)] sm:items-center">
                  <div className="relative mx-auto grid size-28 place-items-center rounded-[32px] border border-[#A3E635]/35 bg-[#110D23] sm:size-32">
                    <Image alt="Voxi présente l'échauffement" height={118} src="/voiceact/warmup/voxi-v2.png" width={118} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">Étape {introGuideStep + 1} sur 3 · Échauffement avec Voxi</p>
                    {introGuideStep === 0 ? <>
                      <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">On réveille la voix avant le cursus.</h3>
                      <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Ce mini-jeu dure moins d&apos;une minute. Il ne teste pas ton talent : il aide ta voix à se placer et mesure seulement ta souplesse du jour.</p>
                    </> : null}
                    {introGuideStep === 1 ? <>
                      <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Trois sons, trois mouvements.</h3>
                      <p className="mt-3 text-base leading-7 text-[#D8CCF4]">« Mmmm » fait monter Voxi. « Ouuu » le fait descendre. « Aaaa » le ramène au milieu. Tu n&apos;as pas besoin de chanter fort.</p>
                    </> : null}
                    {introGuideStep === 2 ? <>
                      <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">D&apos;abord, on adapte la séance à ta voix.</h3>
                      <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Indique simplement comment tu te sens. Ensuite, Voxi apprend tes trois sons avec une courte calibration, puis le vol commence.</p>
                    </> : null}
                    <button className="warmup-primary-button mt-6" onClick={advanceIntroGuide}>{introGuideStep === 2 ? "Choisir ma forme vocale" : "Compris, continuer"}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {stage === "rest" ? (
          <div className="grid min-h-[560px] place-items-center p-6 text-center">
            <div className="max-w-xl">
              <Image alt="" className="mx-auto h-40 w-40 object-contain opacity-90" height={320} src="/voiceact/warmup/voxi-v2.png" width={320} />
              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#FBBF24]">Repos aujourd&apos;hui</p>
              <h2 className="mt-3 text-4xl font-black">On ne force jamais une voix douloureuse.</h2>
              <p className="mt-4 leading-7 text-[#CFC3EA]">
                Tu peux continuer le cursus sans exercice vocal. Si la douleur ou l&apos;enrouement persiste, demande conseil à un professionnel de santé.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button className="warmup-primary-button" onClick={onContinue}>Continuer sans échauffement</button>
                <button className="warmup-secondary-button" onClick={() => setStage("intro")}>Retour</button>
              </div>
            </div>
          </div>
        ) : null}

        {stage === "calibration" ? (
          <div className="grid min-h-[600px] place-items-center p-6 text-center">
            <div className="w-full max-w-2xl">
              <div className="relative mx-auto h-52 w-52">
                <span className="warmup-calibration-ring absolute inset-0 rounded-full border-2 border-[#A3E635]/50" />
                <Image alt="Voxi écoute la voix" className="object-contain p-5" fill sizes="208px" src="/voiceact/warmup/voxi-v2.png" />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">
                Apprentissage des commandes · {Math.min(3, Math.floor(calibrationProgress * 3) + 1)}/3
              </p>
              <h2 className="mt-3 text-5xl font-black">{calibrationStep?.label ?? "Mmmmmmm"}</h2>
              <p className="mt-3 text-base leading-7 text-[#CFC3EA]">
                {calibrationStep?.hint ?? "Un son doux et confortable, sans forcer."}
              </p>
              <div className="mx-auto mt-7 h-3 max-w-lg overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#A3E635] transition-[width] duration-100" style={{ width: `${calibrationProgress * 100}%` }} />
              </div>
              <div className="mt-5 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.15em] text-[#A78BFA]">
                <span className={liveLevel > 8 ? "size-3 rounded-full bg-[#A3E635] shadow-[0_0_14px_#A3E635]" : "size-3 rounded-full bg-white/20"} />
                {liveLevel > 8 ? "Commande captée" : "J'écoute…"}
              </div>
            </div>
          </div>
        ) : null}

        {stage === "error" ? (
          <div className="grid min-h-[520px] place-items-center p-6 text-center">
            <div className="max-w-xl">
              <div className="mx-auto grid size-20 place-items-center rounded-[28px] bg-[#FBBF24]/15 text-3xl">!</div>
              <h2 className="mt-6 text-4xl font-black">On réessaie tranquillement.</h2>
              <p className="mt-4 leading-7 text-[#CFC3EA]">{errorMessage}</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button className="warmup-primary-button" onClick={beginCalibration}>Réessayer</button>
                <button className="warmup-secondary-button" onClick={onContinue}>Continuer sans le jeu</button>
              </div>
            </div>
          </div>
        ) : null}

        {stage === "ready" ? (
          <div className="grid min-h-[580px] place-items-center p-6 text-center">
            <div className="max-w-2xl">
              <div className="warmup-ready-orbit relative mx-auto h-56 w-56">
                <span className="absolute inset-4 rounded-full border border-[#A3E635]/35" />
                <span className="absolute inset-0 rounded-full border border-[#8B5CF6]/25" />
                <Image alt="Voxi est prêt à voler" className="object-contain p-4" fill sizes="224px" src="/voiceact/warmup/voxi-v2.png" />
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Tes trois commandes sont reconnues</p>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl">Traverse les cerceaux sans forcer.</h2>
              <p className="mt-4 leading-7 text-[#CFC3EA]">Mmmm monte, Ouuu descend, Aaaa recentre. Les pauses font partie du jeu.</p>
              <button className="warmup-primary-button mt-7 min-w-56" onClick={startGame}>Lancer le vol</button>
            </div>
          </div>
        ) : null}

        {stage === "countdown" ? (
          <div className="grid min-h-[580px] place-items-center bg-[radial-gradient(circle,rgba(163,230,53,0.17),transparent_36%)] text-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">Le vol commence</p>
              <p className="warmup-countdown mt-2 text-[10rem] font-black leading-none">{Math.max(1, countdown)}</p>
            </div>
          </div>
        ) : null}

        {stage === "playing" ? (
          <div className="warmup-game-shell relative min-h-[620px] overflow-hidden">
            <div className="warmup-sky absolute inset-0" />
            <div className="warmup-sky-drift absolute inset-0" />
            {hitFx ? (
              <div
                className={hitFx.quality === "perfect" ? "warmup-hit-celebration is-perfect" : "warmup-hit-celebration"}
                style={{ left: `${hitFx.x}%`, top: `${hitFx.y}%` }}
                data-label={hitFx.quality === "perfect" ? "PARFAIT +1" : "BIEN +1"}
                aria-hidden="true"
              />
            ) : null}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 bg-gradient-to-b from-[#26114A]/85 to-transparent px-4 pb-12 pt-4 sm:px-7 sm:pt-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Voltige vocale</p>
                <p className="mt-1 text-sm font-black text-white">{Math.max(0, Math.ceil(duration - elapsed))} s</p>
              </div>
              <div className="w-40 sm:w-72">
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-[#A3E635]" style={{ width: `${(elapsed / duration) * 100}%` }} />
                </div>
              </div>
              <div className="rounded-full bg-[#160D2C]/55 px-3 py-2 text-xs font-black backdrop-blur">
                {Object.values(ringOutcomes).filter((value) => value === "hit").length}/{activeRings.length}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-[150px] top-16">
              {visibleRings.map((ring) => {
                const x = PLAYER_X_PERCENT + ((ring.time - elapsed) / LOOK_AHEAD_SECONDS) * (100 - PLAYER_X_PERCENT);
                const y = clamp(50 - ring.semitones * 8.2, 16, 84);
                const outcome = ringOutcomes[ring.id];
                return (
                  <div
                    aria-hidden="true"
                    className={outcome === "hit" ? "warmup-ring is-hit" : outcome === "miss" ? "warmup-ring is-miss" : "warmup-ring"}
                    key={ring.id}
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <span />
                  </div>
                );
              })}

              <div
                className={currentCue.rest ? "warmup-flying-voxi is-resting" : "warmup-flying-voxi"}
                style={{ left: `${PLAYER_X_PERCENT}%`, top: `${mascotTop}%` }}
              >
                <span className={pitchConfidence >= 0.66 ? "warmup-voice-trail is-active" : "warmup-voice-trail"} />
                <Image alt="Voxi vole avec ta voix" height={220} src="/voiceact/warmup/voxi-v2.png" width={220} />
              </div>
            </div>

            <div className="absolute inset-x-3 bottom-3 z-30 sm:inset-x-6 sm:bottom-5">
              <div className={currentCue.rest ? "warmup-live-prompt is-resting" : "warmup-live-prompt"} aria-live="polite">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A3E635]">
                      {currentCue.rest ? "Pause de souffle" : "Commande vocale"}
                    </p>
                    {!currentCue.rest ? (
                      <span className={detectedCommand === currentCue.command ? "warmup-command-status is-correct" : "warmup-command-status"}>
                        {commandLabel(detectedCommand)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-2xl font-black sm:text-4xl">{currentCue.label}</p>
                  <p className="mt-1 truncate text-xs font-bold text-[#D8CCFF] sm:text-sm">{currentCue.hint}</p>
                </div>
                <svg className="h-16 w-28 shrink-0 sm:w-44" viewBox="0 0 176 64" aria-hidden="true">
                  <path d="M8 50 C50 50, 52 14, 92 20 S132 52, 168 18" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d={currentCue.rest
                      ? "M8 34 C54 34, 116 34, 168 34"
                      : currentCue.to > currentCue.from
                        ? "M8 50 C54 50, 116 22, 168 12"
                        : currentCue.to < currentCue.from
                          ? "M8 12 C54 14, 116 46, 168 50"
                          : "M8 32 C54 30, 116 34, 168 32"}
                    fill="none"
                    stroke={currentCue.rest ? "#C4B5FD" : "#A3E635"}
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : null}

        {stage === "result" && result ? (
          <div className="grid min-h-[620px] lg:grid-cols-[0.86fr_1.14fr]">
            <div className="relative min-h-[340px] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.22),transparent_45%)]">
              <Image
                alt="Voxi célèbre la fin de l'échauffement"
                className="warmup-result-voxi object-contain p-8"
                fill
                sizes="(max-width: 1024px) 100vw, 44vw"
                src="/voiceact/warmup/voxi-v2.png"
              />
              {result.reliable ? <div className="warmup-confetti absolute inset-0" aria-hidden="true" /> : null}
            </div>
            <div className="flex items-center p-6 sm:p-9 lg:p-12">
              <div className="w-full">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Échauffement terminé</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-7xl font-black leading-none">{result.score ?? "--"}</span>
                  <span className="pb-2 text-lg font-black text-[#9D8EC4]">/100</span>
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">{feedbackFor(result)}</h2>
                <p className="mt-3 leading-7 text-[#CFC3EA]">
                  {result.reliable
                    ? "Ce score mesure le contrôle relatif de ta voix aujourd'hui. Il ne récompense ni le volume ni les notes les plus hautes."
                    : "Le cursus reste disponible. Tu peux aussi refaire une calibration dans un endroit plus calme."}
                </p>

                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Trajectoire", result.reliable ? result.accuracy : null],
                    ["Fluidité", result.reliable ? result.smoothness : null],
                    ["Continuité", result.reliable ? result.continuity : null],
                    ["Timing", result.reliable ? result.timing : null],
                  ].map(([label, value]) => (
                    <div className="rounded-2xl border border-white/10 bg-[#0D0A1A] p-3" key={label}>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9D8EC4]">{label}</p>
                      <p className="mt-1 text-xl font-black text-[#A3E635]">{value === null ? "--" : value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button className="warmup-primary-button" onClick={onContinue}>Continuer le cursus</button>
                  <button className="warmup-secondary-button" onClick={retry}>Recommencer</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
