import {
  attachApprovedReferenceAudio,
  createPrompterExercise,
  type ApprovedReferenceAudio,
  type PrompterExerciseModel,
} from "./exercise-model";
import type { AnalysisResult } from "./types";

export type EchoStudioModel = {
  id: string;
  kind: "listen-echo-compare";
  source: PrompterExerciseModel;
  rounds: Array<{
    beatId: string;
    text: string;
    intention: string;
    targetWpm: number;
    pauseAfterMs: number;
    listenFirst: true;
  }>;
  progression: {
    oneBeatAtATime: true;
    requiresApprovedReference: true;
    onePriorityAtATime: true;
  };
};

export type EchoStudioResult = {
  canValidate: boolean;
  passed: boolean;
  score: number | null;
  weakestRound: number | null;
  priority: string;
};

export type EchoStudioRoundResult = {
  canValidate: boolean;
  passed: boolean;
  score: number | null;
  priority: string;
};

function scoreRoundSegment(segment: NonNullable<AnalysisResult["segmentAnalyses"]>[number]) {
  const values = [segment.dictionScore, segment.paceScore, segment.pauseScore, segment.energyScore, segment.intonationScore]
    .filter((score): score is number => score !== null);
  return values.length ? Math.round(values.reduce((total, score) => total + score, 0) / values.length) : 0;
}

function buildEchoStudio(source: PrompterExerciseModel): EchoStudioModel {
  return {
    id: `echo-${source.script.id}`,
    kind: "listen-echo-compare",
    source,
    rounds: source.script.beats.map((beat) => ({
      beatId: beat.id,
      text: beat.text,
      intention: beat.intent,
      targetWpm: beat.targetWpm,
      pauseAfterMs: beat.pauseAfterMs,
      listenFirst: true,
    })),
    progression: {
      oneBeatAtATime: true,
      requiresApprovedReference: true,
      onePriorityAtATime: true,
    },
  };
}

export function createEchoStudioModel(scriptId: string): EchoStudioModel {
  return buildEchoStudio(createPrompterExercise(scriptId));
}

export function attachEchoStudioReference(model: EchoStudioModel, reference: ApprovedReferenceAudio): EchoStudioModel {
  return buildEchoStudio(attachApprovedReferenceAudio(model.source, reference));
}

export function evaluateEchoStudioRound(model: EchoStudioModel, roundIndex: number, analysis: AnalysisResult | null): EchoStudioRoundResult {
  if (model.source.reference.state !== "ready" || !analysis?.canValidate || analysis.analysisStatus !== "scored") {
    return {
      canValidate: false,
      passed: false,
      score: null,
      priority: model.source.reference.state !== "ready"
        ? "La reference audio doit etre generee, horodatee et controlee avant cet exercice."
        : "Reprends cette replique avec une voix claire pour obtenir une vraie note.",
    };
  }

  const segment = analysis.segmentAnalyses?.[0];
  if (!segment || !model.rounds[roundIndex]) {
    return {
      canValidate: false,
      passed: false,
      score: null,
      priority: "Cette replique doit etre analysee seule avant de passer a la suite.",
    };
  }

  const score = scoreRoundSegment(segment);
  const passed = segment.dictionScore >= 60
    && (segment.paceScore ?? 0) >= 45
    && (segment.intonationScore ?? 0) >= 40
    && score >= Math.max(62, model.source.evaluation.passThreshold - 8);

  return {
    canValidate: true,
    passed,
    score,
    priority: passed ? "Replique validee. Garde cette intention pour la suivante." : segment.feedback,
  };
}

export function evaluateEchoStudio(model: EchoStudioModel, analysis: AnalysisResult | null): EchoStudioResult {
  if (model.source.reference.state !== "ready" || !analysis?.canValidate || analysis.analysisStatus !== "scored") {
    return {
      canValidate: false,
      passed: false,
      score: null,
      weakestRound: null,
      priority: model.source.reference.state !== "ready"
        ? "La référence audio doit être générée, horodatée et contrôlée avant cet exercice."
        : "La prise doit être analysée avec transcription, MFA et acoustique fiable.",
    };
  }
  const segments = analysis.segmentAnalyses ?? [];
  if (segments.length !== model.rounds.length) {
    return { canValidate: false, passed: false, score: null, weakestRound: null, priority: "Toutes les répliques doivent être analysées avant la note." };
  }
  const scores = segments.map(scoreRoundSegment);
  const weakestRound = scores.reduce((weakest, score, index) => score < scores[weakest] ? index : weakest, 0);
  const everyRoundPlayable = segments.every((segment) => segment.dictionScore >= 60 && (segment.paceScore ?? 0) >= 45 && (segment.intonationScore ?? 0) >= 40);
  const score = Math.round(scores.reduce((total, value) => total + value, 0) / Math.max(1, scores.length));
  const passed = everyRoundPlayable && score >= model.source.evaluation.passThreshold;
  return {
    canValidate: true,
    passed,
    score,
    weakestRound,
    priority: segments[weakestRound]?.feedback ?? "Rejoue une réplique, une intention à la fois.",
  };
}

export function assertEchoStudioModel(model: EchoStudioModel) {
  if (model.rounds.length !== model.source.script.beats.length) throw new Error(`${model.id}: répliques incomplètes.`);
  if (!model.progression.oneBeatAtATime || !model.progression.onePriorityAtATime) throw new Error(`${model.id}: guidance insuffisante.`);
  if (!model.progression.requiresApprovedReference) throw new Error(`${model.id}: référence non contrôlée.`);
  for (const [index, round] of model.rounds.entries()) {
    const beat = model.source.script.beats[index];
    if (!beat || round.text !== beat.text || !round.listenFirst) throw new Error(`${model.id}: séquence d'écoute invalide.`);
  }
  if (model.source.reference.state === "ready" && !model.source.reference.canPlayExample) {
    throw new Error(`${model.id}: référence prête mais non jouable.`);
  }
  return model;
}
