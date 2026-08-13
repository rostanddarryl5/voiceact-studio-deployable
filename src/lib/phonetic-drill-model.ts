import { dictionDrillToLesson, dictionRushDrills, type DictionRushDrill } from "./diction-rush";
import type { AnalysisResult, Lesson, PhoneAssessment } from "./types";

export type DictionRushModel = {
  id: string;
  kind: "phonetic-precision-rush";
  drill: DictionRushDrill;
  lesson: Lesson;
  guide: {
    steps: [string, string, string];
    liveMeterIsInformativeOnly: true;
  };
  evaluation: {
    passThreshold: number;
    requiresSpeech: true;
    requiresReliableTranscription: true;
    requiresMfaPhonemeConfidence: true;
    targetPhones: string[];
  };
};

export type DictionRushTargetResult = {
  score: number | null;
  canPass: boolean;
  assessments: Array<PhoneAssessment | null>;
  priority: string | null;
};

function targetAssessment(analysis: AnalysisResult, target: string) {
  return (analysis.pronunciation?.phones ?? [])
    .filter((phone) => phone.displayPhone === target || phone.phone === target)
    .sort((left, right) => (left.score ?? 101) - (right.score ?? 101))[0] ?? null;
}

export function assessDictionRushTargets(model: DictionRushModel, analysis: AnalysisResult | null): DictionRushTargetResult {
  if (!analysis) return { score: null, canPass: false, assessments: [], priority: null };
  const assessments = model.evaluation.targetPhones.map((target) => targetAssessment(analysis, target));
  const scored = assessments.filter((item): item is PhoneAssessment => item?.score !== null);
  const score = scored.length === assessments.length && scored.length
    ? Math.round(scored.reduce((total, item) => total + (item.score ?? 0), 0) / scored.length)
    : null;
  const weakest = [...scored].sort((left, right) => (left.score ?? 100) - (right.score ?? 100))[0] ?? null;
  return {
    score,
    assessments,
    canPass: analysis.analysisStatus === "scored"
      && analysis.canValidate === true
      && analysis.pronunciation?.canValidate === true
      && score !== null
      && scored.length === assessments.length
      && scored.every((item) => (item.score ?? 0) >= model.evaluation.passThreshold),
    priority: weakest && weakest.status !== "good" ? weakest.feedback : null,
  };
}

export function createDictionRushModel(drillId: string): DictionRushModel {
  const drill = dictionRushDrills.find((item) => item.id === drillId);
  if (!drill) throw new Error(`Manche de diction introuvable : ${drillId}`);
  return {
    id: `phonetic-${drill.id}`,
    kind: "phonetic-precision-rush",
    drill,
    lesson: dictionDrillToLesson(drill),
    guide: {
      steps: [
        "Lis une phrase courte et garde le son naturel.",
        "Les portes représentent les sons que VoiceAct écoutera après la prise.",
        "Termine la prise : seule une analyse exploitable peut ouvrir la manche.",
      ],
      liveMeterIsInformativeOnly: true,
    },
    evaluation: {
      passThreshold: drill.passScore,
      requiresSpeech: true,
      requiresReliableTranscription: true,
      requiresMfaPhonemeConfidence: true,
      targetPhones: drill.targetPhones,
    },
  };
}

export function didPassDictionRush(model: DictionRushModel, analysis: AnalysisResult | null) {
  return assessDictionRushTargets(model, analysis).canPass;
}

export function isDictionRushStepUnlocked(index: number, passedDrillIds: Set<string>) {
  if (index <= 0) return true;
  const previous = dictionRushDrills[index - 1];
  return Boolean(previous && passedDrillIds.has(previous.id));
}

export function assertDictionRushModel(model: DictionRushModel) {
  if (!model.drill.text.trim()) throw new Error(`${model.id}: texte absent.`);
  if (model.drill.targetPhones.length < 2) throw new Error(`${model.id}: sons cibles insuffisants.`);
  if (model.lesson.segments.length !== 1 || model.lesson.segments[0]?.text !== model.drill.text) {
    throw new Error(`${model.id}: le texte de notation diffère du texte affiché.`);
  }
  if (!model.guide.liveMeterIsInformativeOnly) throw new Error(`${model.id}: le niveau live ne doit jamais décider du score.`);
  if (model.evaluation.passThreshold !== model.drill.passScore) throw new Error(`${model.id}: seuil incohérent.`);
  return model;
}
