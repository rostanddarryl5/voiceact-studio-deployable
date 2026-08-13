import { getAdaptiveLessonRecommendation, getLessonsForGoal } from "./curriculum";
import { lessons } from "./lessons";
import type { AnalysisResult, BaselineRecord, Lesson, OnboardingProfile } from "./types";

export type DiagnosticExerciseModel = {
  id: "diagnostic-initial";
  kind: "adaptive-baseline";
  onboarding: {
    fields: ["goal", "specialty", "level", "frequency"];
    maxQuestions: 4;
  };
  lesson: Lesson;
  guide: {
    steps: [string, string, string];
    scoreIsNotAPassGrade: true;
  };
  validation: {
    requiresSpeech: true;
    requiresExactTranscript: false;
    requiresPhonemeAlignment: false;
    advancedPhonemeAlignmentOptional: true;
    requiresAcousticAnalysis: true;
  };
};

export type DiagnosticBaselineMetadata = {
  attemptId: string;
  createdAt: string;
  audioStored: boolean;
};

export type DiagnosticCursus = {
  firstLessonId: string;
  firstLessonTitle: string;
  focus: string;
  reason: string;
  lessons: Lesson[];
};

export function createDiagnosticExerciseModel(): DiagnosticExerciseModel {
  const lesson = lessons.find((item) => item.category === "Diagnostic");
  if (!lesson) throw new Error("Leçon de diagnostic introuvable.");
  return {
    id: "diagnostic-initial",
    kind: "adaptive-baseline",
    onboarding: { fields: ["goal", "specialty", "level", "frequency"], maxQuestions: 4 },
    lesson,
    guide: {
      steps: [
        "Réponds à quatre questions pour choisir le bon contexte vocal.",
        "Lis une seule prise guidée : les silences et l'intention sont affichés dans le prompteur.",
        "VoiceAct mesure ton point de départ et prépare la première priorité de ton cursus.",
      ],
      scoreIsNotAPassGrade: true,
    },
    validation: {
      requiresSpeech: true,
      requiresExactTranscript: false,
      requiresPhonemeAlignment: false,
      advancedPhonemeAlignmentOptional: true,
      requiresAcousticAnalysis: true,
    },
  };
}

export function canCreateDiagnosticBaseline(analysis: AnalysisResult | null) {
  return Boolean(
    analysis
    && analysis.analysisStatus === "scored"
    && analysis.dimensionScores
    && analysis.transcript?.trim()
    && (analysis.acousticQuality === "high" || analysis.acousticQuality === "limited")
    && (analysis.confidence ?? 0) >= 0.35
  );
}

export function createDiagnosticBaseline(
  analysis: AnalysisResult | null,
  metadata: DiagnosticBaselineMetadata,
): BaselineRecord | null {
  if (!canCreateDiagnosticBaseline(analysis) || !analysis?.dimensionScores) return null;
  return {
    attemptId: metadata.attemptId,
    lessonId: createDiagnosticExerciseModel().lesson.id,
    score: analysis.globalScore,
    dimensions: analysis.dimensionScores,
    transcript: analysis.transcript?.trim() ?? "",
    confidence: analysis.confidence ?? 0,
    createdAt: metadata.createdAt,
    audioStored: metadata.audioStored,
  };
}

export function buildDiagnosticCursus(
  profile: OnboardingProfile,
  analysis: AnalysisResult,
): DiagnosticCursus | null {
  if (!canCreateDiagnosticBaseline(analysis)) return null;
  const recommendation = getAdaptiveLessonRecommendation(analysis, profile, {});
  const track = getLessonsForGoal(profile.goal, profile.specialty)
    .filter((lesson) => lesson.category !== "Diagnostic");
  const recommended = track.find((lesson) => lesson.id === recommendation.lessonId) ?? track[0];
  if (!recommended) return null;
  const ordered = [recommended, ...track.filter((lesson) => lesson.id !== recommended.id)];
  return {
    firstLessonId: recommended.id,
    firstLessonTitle: recommended.title,
    focus: recommendation.focus,
    reason: recommendation.reason,
    lessons: ordered,
  };
}

export function assertDiagnosticExerciseModel(model: DiagnosticExerciseModel) {
  if (model.onboarding.fields.length !== model.onboarding.maxQuestions) throw new Error("Diagnostic : nombre de questions incohérent.");
  if (model.lesson.category !== "Diagnostic") throw new Error("Diagnostic : leçon de référence invalide.");
  if (model.lesson.segments.length < 2) throw new Error("Diagnostic : diversité vocale insuffisante.");
  if (!model.guide.scoreIsNotAPassGrade) throw new Error("Diagnostic : le score ne doit pas bloquer le cursus.");
  return model;
}
