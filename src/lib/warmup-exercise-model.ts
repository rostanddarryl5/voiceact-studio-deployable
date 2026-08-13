export type WarmupVoiceState = "available" | "fatigued" | "painful";

export type WarmupMeasurement = {
  ringCount: number;
  ringHits: number;
  ringErrors: number[];
  activeFrames: number;
  voicedFrames: number;
  suddenJumps: number;
};

export type WarmupScore = {
  score: number | null;
  accuracy: number;
  smoothness: number;
  continuity: number;
  timing: number;
  reliable: boolean;
  reason: string;
};

export type DailyWarmupModel = {
  id: "daily-voxi-warmup";
  kind: "live-vocal-warmup";
  durations: { available: number; fatigued: number };
  safety: { painfulVoiceSkipsGame: true; calibrationRequiresThreeCommands: true };
  guide: { steps: [string, string, string] };
  scoring: { minimumMeasuredRings: number; minimumContinuityPercent: number; liveMeterIsInformativeOnly: true };
};

export const dailyWarmupModel: DailyWarmupModel = {
  id: "daily-voxi-warmup",
  kind: "live-vocal-warmup",
  durations: { available: 48, fatigued: 32 },
  safety: { painfulVoiceSkipsGame: true, calibrationRequiresThreeCommands: true },
  guide: {
    steps: [
      "Choisis comment se sent ta voix aujourd'hui : une voix douloureuse se repose.",
      "Voxi apprend Mmmm, Ouuu et Aaaa avant de commencer le vol.",
      "Le score mesure uniquement le contrôle relatif de la séance, jamais la puissance de ta voix.",
    ],
  },
  scoring: { minimumMeasuredRings: 5, minimumContinuityPercent: 24, liveMeterIsInformativeOnly: true },
};

export function warmupDurationFor(state: WarmupVoiceState) {
  return state === "fatigued" ? dailyWarmupModel.durations.fatigued : dailyWarmupModel.durations.available;
}

export function shouldSkipWarmupForSafety(state: WarmupVoiceState) {
  return state === "painful";
}

export function isWarmupCalibrationReady(usablePitchSamples: number, recognizedCommandProfiles: number) {
  return usablePitchSamples >= 8 && recognizedCommandProfiles === 3;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function scoreWarmupMeasurement(measurement: WarmupMeasurement): WarmupScore {
  const measuredErrors = measurement.ringErrors.filter((value) => Number.isFinite(value));
  const accuracy = measuredErrors.length
    ? Math.round(measuredErrors.reduce((sum, error) => sum + clamp(100 - (error / 1.8) * 100, 0, 100), 0) / measuredErrors.length)
    : 0;
  const timing = measurement.ringCount
    ? Math.round((measurement.ringHits / measurement.ringCount) * 100)
    : 0;
  const continuity = measurement.activeFrames
    ? Math.round((measurement.voicedFrames / measurement.activeFrames) * 100)
    : 0;
  const smoothness = measurement.activeFrames
    ? Math.round(clamp(100 - (measurement.suddenJumps / measurement.activeFrames) * 520, 0, 100))
    : 0;
  const enoughRings = measuredErrors.length >= dailyWarmupModel.scoring.minimumMeasuredRings;
  const reliable = enoughRings && continuity >= dailyWarmupModel.scoring.minimumContinuityPercent;
  const score = reliable
    ? Math.round(accuracy * 0.45 + smoothness * 0.25 + continuity * 0.2 + timing * 0.1)
    : null;
  return {
    score,
    accuracy,
    smoothness,
    continuity,
    timing,
    reliable,
    reason: reliable ? "Mouvement vocal suffisamment mesuré." : "Pas assez de voix claire ou de cerceaux mesurés pour donner une note honnête.",
  };
}

export function assertDailyWarmupModel(model: DailyWarmupModel = dailyWarmupModel) {
  if (model.durations.available <= model.durations.fatigued) throw new Error("Échauffement : la séance fatiguée doit être plus courte.");
  if (!model.safety.painfulVoiceSkipsGame) throw new Error("Échauffement : une voix douloureuse ne doit pas jouer.");
  if (!model.safety.calibrationRequiresThreeCommands) throw new Error("Échauffement : calibration incomplète.");
  if (!model.scoring.liveMeterIsInformativeOnly) throw new Error("Échauffement : le niveau live ne peut pas produire une note.");
  return model;
}
