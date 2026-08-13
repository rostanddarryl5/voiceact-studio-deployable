import { clampScore } from "./audio-analysis";
import type {
  DetailedAudioMetrics,
  PhoneAssessment,
  PhoneAssessmentStatus,
  PhonemeAlignment,
  PronunciationAssessment,
  WordPronunciationAssessment,
} from "./types";

const VOWELS = new Set([
  "a", "ɑ", "ɑ̃", "e", "ɛ", "ɛ̃", "ə", "i", "o", "ɔ", "ɔ̃", "u", "y", "ø", "œ", "œ̃",
]);
const NASALS = new Set(["m", "n", "ɲ", "ŋ"]);
const LIQUIDS = new Set(["l", "ʁ", "r", "j", "w", "ɥ"]);
const VOICED_CONSONANTS = new Set(["b", "d", "ɡ", "g", "v", "z", "ʒ"]);
const UNVOICED_CONSONANTS = new Set(["p", "t", "k", "f", "s", "ʃ"]);

type PhoneClass = PhoneAssessment["phoneClass"];

function normalizePhone(phone: string) {
  return phone
    .trim()
    .replace(/_[BIES]$/u, "")
    .replace(/[0-2]$/u, "")
    .normalize("NFC");
}

function phoneClass(phone: string): PhoneClass {
  const normalized = normalizePhone(phone);
  if (VOWELS.has(normalized)) return "vowel";
  if (NASALS.has(normalized)) return "nasal";
  if (LIQUIDS.has(normalized)) return "liquid";
  if (VOICED_CONSONANTS.has(normalized)) return "voiced-consonant";
  if (UNVOICED_CONSONANTS.has(normalized)) return "unvoiced-consonant";
  return "other";
}

function durationRange(kind: PhoneClass): [number, number] {
  switch (kind) {
    case "vowel":
      return [35, 420];
    case "nasal":
      return [25, 300];
    case "liquid":
      return [20, 280];
    case "voiced-consonant":
      return [18, 240];
    case "unvoiced-consonant":
      return [15, 260];
    default:
      return [12, 450];
  }
}

function durationScore(durationMs: number, kind: PhoneClass) {
  const [minimum, maximum] = durationRange(kind);
  if (durationMs >= minimum && durationMs <= maximum) return 100;
  const distance = durationMs < minimum ? minimum - durationMs : durationMs - maximum;
  const tolerance = durationMs < minimum ? minimum : maximum * 0.65;
  return clampScore(100 - (distance / Math.max(1, tolerance)) * 100);
}

/**
 * MFA phone_goodness is a frame-averaged log-likelihood margin:
 * 0 means the expected phone won every frame; larger values mean a competing
 * phone fitted the signal better. This transform is monotonic and versioned,
 * so it can be recalibrated later without changing stored raw evidence.
 */
export function normalizeMfaPhoneGoodness(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  return clampScore(100 * Math.exp(-value / 10));
}

function statusForScore(score: number | null): PhoneAssessmentStatus {
  if (score === null) return "unscored";
  if (score >= 78) return "good";
  if (score >= 55) return "fragile";
  return "retry";
}

function framesForInterval(metrics: DetailedAudioMetrics, start: number, end: number) {
  return metrics.frames.filter((frame) => frame.end >= start && frame.start <= end);
}

function acousticPresence(metrics: DetailedAudioMetrics, start: number, end: number, kind: PhoneClass) {
  const frames = framesForInterval(metrics, start, end);
  if (!frames.length) {
    return { score: 0, voicedRatio: null, meanIntensityDb: null };
  }

  const active = frames.filter((frame) => frame.isSpeech || frame.dbfs >= metrics.medianSpeechDbfs - 18);
  const voiced = frames.filter((frame) => frame.pitchHz !== null && frame.pitchConfidence >= 0.5);
  const activeRatio = active.length / frames.length;
  const voicedRatio = voiced.length / frames.length;
  const meanIntensityDb = frames.reduce((sum, frame) => sum + frame.dbfs, 0) / frames.length;

  // An unvoiced consonant (/s/, /f/, /ʃ/, /p/, /t/, /k/) must not be
  // penalized because Praat correctly finds no F0.
  if (kind === "unvoiced-consonant") {
    return { score: clampScore(activeRatio * 100), voicedRatio, meanIntensityDb };
  }
  if (kind === "vowel" || kind === "nasal" || kind === "voiced-consonant") {
    return {
      score: clampScore(activeRatio * 65 + Math.min(1, voicedRatio / 0.55) * 35),
      voicedRatio,
      meanIntensityDb,
    };
  }
  return { score: clampScore(activeRatio * 85 + Math.min(1, voicedRatio / 0.35) * 15), voicedRatio, meanIntensityDb };
}

function feedbackFor(phone: string, kind: PhoneClass, status: PhoneAssessmentStatus) {
  if (status === "good") return "Son net et acoustiquement cohérent.";
  if (status === "unscored") return "Son localisé, mais confiance acoustique MFA absente.";
  switch (kind) {
    case "vowel":
      return `Stabilise la voyelle /${phone}/ sans l'avaler ni la tendre artificiellement.`;
    case "nasal":
      return `Garde la résonance du /${phone}/ et termine le son avant d'enchaîner.`;
    case "liquid":
      return `Rends le /${phone}/ plus continu, sans couper le flux de la syllabe.`;
    case "voiced-consonant":
      return `Fais entendre l'attaque du /${phone}/ tout en gardant la vibration.`;
    case "unvoiced-consonant":
      return `Dessine plus nettement l'attaque du /${phone}/ sans ajouter de voyelle.`;
    default:
      return `Reprends le son /${phone}/ lentement, puis réintègre-le dans le mot.`;
  }
}

function aggregateStatus(phones: PhoneAssessment[]): PhoneAssessmentStatus {
  const scored = phones.filter((phone) => phone.score !== null);
  if (!scored.length) return "unscored";
  if (scored.some((phone) => phone.status === "retry")) return "retry";
  if (scored.some((phone) => phone.status === "fragile")) return "fragile";
  return "good";
}

function weightedAverage(items: Array<{ value: number; weight: number }>) {
  const weight = items.reduce((sum, item) => sum + item.weight, 0);
  if (!weight) return null;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
}

export function buildPronunciationAssessment(
  alignment: PhonemeAlignment | undefined,
  metrics: DetailedAudioMetrics,
): PronunciationAssessment {
  if (!alignment?.phones.length) {
    return {
      engine: "voiceact-phonetic-v1",
      status: "unavailable",
      score: null,
      reliability: 0,
      canValidate: false,
      scoringReason: "MFA n'a pas fourni d'alignement phonétique.",
      evidenceCoverage: 0,
      assessedPhoneCount: 0,
      weakPhoneCount: 0,
      phones: [],
      words: [],
      priority: null,
    };
  }

  const phones: PhoneAssessment[] = alignment.phones.map((interval) => {
    const normalized = normalizePhone(interval.phone);
    const kind = phoneClass(normalized);
    const acousticMatchScore = normalizeMfaPhoneGoodness(interval.phoneGoodness);
    const measuredDurationScore = durationScore(interval.durationMs, kind);
    const presence = acousticPresence(metrics, interval.start, interval.end, kind);
    const score = acousticMatchScore === null
      ? null
      : clampScore(acousticMatchScore * 0.72 + measuredDurationScore * 0.13 + presence.score * 0.15);
    const status = statusForScore(score);
    const word = interval.wordIndex === null ? null : alignment.words[interval.wordIndex]?.word ?? null;

    return {
      phone: interval.phone,
      displayPhone: normalized,
      word,
      wordIndex: interval.wordIndex,
      start: interval.start,
      end: interval.end,
      durationMs: interval.durationMs,
      phoneClass: kind,
      status,
      score,
      acousticMatchScore,
      durationScore: measuredDurationScore,
      presenceScore: presence.score,
      voicedRatio: presence.voicedRatio,
      meanIntensityDb: presence.meanIntensityDb,
      feedback: feedbackFor(normalized, kind, status),
    };
  });

  const scoredPhones = phones.filter((phone) => phone.score !== null);
  const evidenceCoverage = scoredPhones.length / Math.max(1, phones.length);
  const score = weightedAverage(
    scoredPhones.map((phone) => ({ value: phone.score as number, weight: Math.max(20, phone.durationMs) })),
  );
  const reliability = Math.min(
    1,
    evidenceCoverage * 0.68
      + (metrics.acousticQuality === "high" ? 0.2 : 0.06)
      + Math.min(0.12, scoredPhones.length / 100),
  );
  const canValidate = alignment.canScorePronunciation
    && alignment.scoreKind === "mfa-phone-confidence"
    && evidenceCoverage >= 0.7
    && scoredPhones.length >= 4
    && reliability >= 0.72
    && metrics.acousticQuality === "high";

  const words: WordPronunciationAssessment[] = alignment.words.map((word, wordIndex) => {
    const wordPhones = phones.filter((phone) => phone.wordIndex === wordIndex);
    const wordScore = weightedAverage(
      wordPhones
        .filter((phone) => phone.score !== null)
        .map((phone) => ({ value: phone.score as number, weight: Math.max(20, phone.durationMs) })),
    );
    return {
      word: word.word,
      wordIndex,
      score: wordScore === null ? null : clampScore(wordScore),
      status: aggregateStatus(wordPhones),
      phones: wordPhones,
    };
  });

  const weakPhones = scoredPhones
    .filter((phone) => phone.status === "retry" || phone.status === "fragile")
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
  const priorityPhone = weakPhones[0] ?? null;
  const priority = priorityPhone
    ? `${priorityPhone.word ? `Dans « ${priorityPhone.word} », ` : ""}${priorityPhone.feedback}`
    : scoredPhones.length
      ? "Les sons mesurés sont cohérents. Garde la même netteté à vitesse réelle."
      : null;

  return {
    engine: "voiceact-phonetic-v1",
    status: canValidate ? "scored" : "informative",
    score: score === null ? null : clampScore(score),
    reliability,
    canValidate,
    scoringReason: canValidate
      ? "Score fondé sur la marge acoustique MFA, la durée et la présence du signal pour chaque phonème."
      : alignment.scoringReason,
    evidenceCoverage,
    assessedPhoneCount: scoredPhones.length,
    weakPhoneCount: weakPhones.length,
    phones,
    words,
    priority,
  };
}

