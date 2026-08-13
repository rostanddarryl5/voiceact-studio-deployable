import { clampScore } from "./audio-analysis";
import { lessons } from "./lessons";
import type { AnalysisResult, Lesson, OnboardingProfile, VoiceSpecialty } from "./types";

export type AppSection = "diagnostic" | "dashboard" | "exercises" | "warmup" | "diction" | "articulation" | "echo" | "session" | "results" | "progress" | "badges";

export type VoiceDimension = {
  label: "Clarte" | "Rythme" | "Intonation" | "Expressivite";
  value: number;
  hint: string;
  measured?: boolean;
};

export const PASS_SCORE = 70;

export const appSections: Array<{ id: AppSection; label: string; short: string }> = [
  { id: "diagnostic", label: "Diagnostic", short: "Diag" },
  { id: "dashboard", label: "Dashboard", short: "Home" },
  { id: "exercises", label: "Exercices", short: "Exos" },
  { id: "diction", label: "Diction Rush", short: "Rush" },
  { id: "articulation", label: "Articulation Lab", short: "Artic" },
  { id: "echo", label: "Echo Studio", short: "Echo" },
  { id: "session", label: "Studio", short: "Rec" },
  { id: "results", label: "Resultats", short: "Score" },
  { id: "progress", label: "Progression", short: "Prog" },
  { id: "badges", label: "Badges", short: "Badges" },
];

export const lessonFilters = ["Tous", "Diagnostic", "Voix off createur", "Doublage cinema", "Hook", "Narration", "Emotion", "Publicite"];

export const creatorTrackLessonIds = ["horror-hook-1", "documentary-hook-1", "siwis-emphasis-1", "news-urgency-1", "ad-energy-1"];
export const dubbingTrackLessonIds = ["dubbing-threat-1", "sad-scene-1"];

const specialtyTracks: Partial<Record<VoiceSpecialty, string[]>> = {
  "Short dynamique": ["news-urgency-1", "ad-energy-1", "siwis-emphasis-1", "horror-hook-1", "documentary-hook-1"],
  "Video longue storytelling": ["siwis-emphasis-1", "documentary-hook-1", "horror-hook-1", "news-urgency-1", "ad-energy-1"],
  "Actualite journalisme": ["news-urgency-1", "siwis-emphasis-1", "documentary-hook-1", "ad-energy-1", "horror-hook-1"],
  "Horreur suspense": ["horror-hook-1", "siwis-emphasis-1", "documentary-hook-1", "news-urgency-1", "ad-energy-1"],
  "Publicite UGC": ["ad-energy-1", "siwis-emphasis-1", "news-urgency-1", "documentary-hook-1", "horror-hook-1"],
  "Film serie": ["dubbing-threat-1", "sad-scene-1"],
  "Animation dessin anime": ["sad-scene-1", "dubbing-threat-1"],
  "Jeu video": ["dubbing-threat-1", "sad-scene-1"],
};

export function getTrackLessonIds(
  goal: OnboardingProfile["goal"] | undefined,
  specialty?: VoiceSpecialty,
) {
  if (specialty && specialtyTracks[specialty]) return specialtyTracks[specialty];
  return goal === "Doublage cinema" ? dubbingTrackLessonIds : creatorTrackLessonIds;
}

export function getLessonsForGoal(goal: OnboardingProfile["goal"] | undefined, specialty?: VoiceSpecialty) {
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const track = getTrackLessonIds(goal, specialty)
    .map((id) => lessonById.get(id))
    .filter((lesson): lesson is Lesson => Boolean(lesson));
  return [lessons[0], ...track];
}

export function getLessonTone(lesson: Lesson) {
  return lesson.emotion;
}

export function getScoreGrade(score: number) {
  if (score >= 90) return "Studio pro";
  if (score >= 80) return "Tres convaincant";
  if (score >= PASS_SCORE) return "Bonne base";
  if (score >= 55) return "A retravailler";
  return "Reprise necessaire";
}

export function isLessonUnlocked(
  index: number,
  lessonScores: Record<string, number>,
  options?: {
    diagnosticCompleted?: boolean;
    recommendedLessonId?: string | null;
    goal?: OnboardingProfile["goal"];
    specialty?: VoiceSpecialty;
  },
) {
  if (index === 0) return true;
  if (!options?.diagnosticCompleted) return false;
  const lesson = lessons[index];
  if (lessonScores[lesson.id] !== undefined) return true;
  if (options.recommendedLessonId === lesson.id) return true;
  const track = getTrackLessonIds(options.goal, options.specialty);
  const trackPosition = track.indexOf(lesson.id);
  if (trackPosition < 0) return false;
  if (trackPosition === 0) return true;
  const previousLesson = lessons.find((item) => item.id === track[trackPosition - 1]);
  if (!previousLesson) return false;
  return (lessonScores[previousLesson.id] ?? 0) >= PASS_SCORE;
}

export function buildDimensions(analysis: AnalysisResult | null): VoiceDimension[] {
  if (!analysis || analysis.analysisStatus !== "scored") {
    return [
      { label: "Clarte", value: 0, hint: "En attente" },
      { label: "Rythme", value: 0, hint: "En attente" },
      { label: "Intonation", value: 0, hint: "En attente" },
      { label: "Expressivite", value: 0, hint: "En attente" },
    ];
  }

  if (analysis.dimensionScores) {
    return [
      {
        label: "Clarte",
        value: analysis.dimensionScores.clarity,
        hint: analysis.analysisMode === "full" ? `${analysis.wordAccuracyPercent ?? 0}% des mots conformes` : "Non mesurée sans transcription",
        measured: analysis.analysisMode === "full",
      },
      {
        label: "Rythme",
        value: analysis.dimensionScores.rhythm,
        hint: `${analysis.wpm} mots/min`,
      },
      {
        label: "Intonation",
        value: analysis.dimensionScores.intonation,
        hint: `${Math.round(analysis.pitchRangeSemitones ?? 0)} demi-tons utiles`,
      },
      {
        label: "Expressivite",
        value: analysis.dimensionScores.expressiveness,
        hint: "Énergie relative aux intentions",
      },
    ];
  }

  const paceGap = Math.abs(analysis.wpm - analysis.targetWpm);
  const pauseGap = Math.abs(analysis.pauseCount - analysis.expectedPauses);

  return [
    {
      label: "Clarte",
      value: clampScore(analysis.rmsPercent * 1.6 + analysis.peakPercent * 0.3),
      hint: "Presence et volume utile",
    },
    {
      label: "Rythme",
      value: clampScore(100 - paceGap * 1.35 - pauseGap * 8),
      hint: `${analysis.wpm} mots/min`,
    },
    {
      label: "Intonation",
      value: clampScore(52 + analysis.energyVariationPercent * 1.1),
      hint: "Variation vocale",
    },
    {
      label: "Expressivite",
      value: clampScore(analysis.globalScore * 0.58 + analysis.energyVariationPercent * 0.42),
      hint: "Emotion transmise",
    },
  ];
}

export function getWeakestDimension(dimensions: VoiceDimension[]) {
  const measured = dimensions.filter((dimension) => dimension.measured !== false);
  return measured.reduce((weakest, current) => (current.value < weakest.value ? current : weakest), measured[0] ?? dimensions[0]);
}

export function getBestDimension(dimensions: VoiceDimension[]) {
  const measured = dimensions.filter((dimension) => dimension.measured !== false);
  return measured.reduce((best, current) => (current.value > best.value ? current : best), measured[0] ?? dimensions[0]);
}

export function getRecommendedRemediation(dimensions: VoiceDimension[]) {
  const weakest = getWeakestDimension(dimensions);

  if (weakest.label === "Rythme") {
    return {
      focus: "Rythme et silences",
      reason: "Le cursus doit renforcer le debit, les respirations et les pauses de sens.",
      nextExerciseType: "pauses/debit",
    };
  }

  if (weakest.label === "Clarte") {
    return {
      focus: "Diction et presence",
      reason: "Le cursus doit proposer articulation, projection douce et consonnes propres.",
      nextExerciseType: "diction",
    };
  }

  if (weakest.label === "Intonation") {
    return {
      focus: "Courbe vocale",
      reason: "Le cursus doit proposer imitation, montee/descente et variation de hauteur.",
      nextExerciseType: "intonation",
    };
  }

  return {
    focus: "Expressivite",
    reason: "Le cursus doit proposer emotions contrastees, intention et jeu plus engage.",
    nextExerciseType: "emotion",
  };
}

export type AdaptiveLessonRecommendation = ReturnType<typeof getRecommendedRemediation> & {
  lessonId: string;
  lessonTitle: string;
  dimension: VoiceDimension["label"];
};

function firstAvailableLesson(
  candidates: string[],
  lessonScores: Record<string, number>,
  currentLessonId?: string,
) {
  return candidates.find((id) => id !== currentLessonId && (lessonScores[id] ?? 0) < PASS_SCORE)
    ?? candidates.find((id) => id !== currentLessonId)
    ?? candidates[0];
}

export function getAdaptiveLessonRecommendation(
  analysis: AnalysisResult,
  profile: OnboardingProfile | null,
  lessonScores: Record<string, number>,
  currentLessonId?: string,
): AdaptiveLessonRecommendation {
  const dimensions = buildDimensions(analysis);
  const remediation = getRecommendedRemediation(dimensions);
  const weakest = getWeakestDimension(dimensions);
  const dubbing = profile?.goal === "Doublage cinema";
  let candidates: string[];

  if (weakest.label === "Clarte") {
    candidates = dubbing
      ? ["dubbing-threat-1", "sad-scene-1", "documentary-hook-1"]
      : ["documentary-hook-1", "news-urgency-1", "horror-hook-1"];
  } else if (weakest.label === "Rythme") {
    const tooFast = analysis.wpm > analysis.targetWpm + 8;
    candidates = dubbing
      ? tooFast ? ["dubbing-threat-1", "sad-scene-1"] : ["sad-scene-1", "dubbing-threat-1"]
      : tooFast ? ["horror-hook-1", "documentary-hook-1"] : ["news-urgency-1", "ad-energy-1"];
  } else if (weakest.label === "Intonation") {
    candidates = dubbing
      ? ["dubbing-threat-1", "sad-scene-1"]
      : ["horror-hook-1", "documentary-hook-1", "news-urgency-1"];
  } else {
    candidates = dubbing
      ? ["sad-scene-1", "dubbing-threat-1"]
      : ["ad-energy-1", "horror-hook-1", "news-urgency-1"];
  }

  const lessonId = firstAvailableLesson(candidates, lessonScores, currentLessonId);
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[1];
  return {
    ...remediation,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    dimension: weakest.label,
  };
}
