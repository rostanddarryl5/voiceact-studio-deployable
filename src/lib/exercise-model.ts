import { getTtsProfileById, getTtsScriptById } from "../data/tts-reference-corpus";
import { getApprovedReferenceAudio } from "../data/approved-reference-audio";
import { buildGeminiTtsPrompt, type TtsReferenceScript, type TtsSkill, type TtsVoiceProfile } from "./tts-corpus";
import type { IntonationShape, Lesson, LessonSegment } from "./types";

export type ExerciseReferenceState = "awaiting_tts_audio" | "awaiting_human_review" | "ready";

export type ApprovedReferenceAudio = {
  localPath: string;
  license: string;
  humanReviewedAt: string;
  /** Measured from the final WAV/MP3, never guessed from the written script. */
  durationSeconds: number;
  /** Proof that the approved text was aligned against this exact final audio by MFA. */
  mfa: {
    wordAlignment: "mfa";
    phonemeAlignment: "mfa";
    phoneConfidence: "mfa-phone-confidence";
    validatedAt: string;
  };
  /** Timings measured from the final audio, relative to each director beat. */
  wordTimingsByBeat: Record<string, Array<{ word: string; startMs: number; endMs: number }>>;
};

export type PrompterExerciseModel = {
  id: string;
  kind: "guided-prompter-imitation";
  script: TtsReferenceScript;
  profile: TtsVoiceProfile;
  lesson: Lesson;
  reference: {
    state: ExerciseReferenceState;
    geminiPrompt: string;
    expectedDurationSeconds: [number, number];
    canPlayExample: boolean;
    canValidateForProgress: boolean;
    humanReviewedAt?: string;
  };
  evaluation: {
    passThreshold: number;
    scoringWeights: Record<TtsSkill, number>;
    requiresExactTranscript: true;
    requiresPhonemeAlignment: true;
    requiresAcousticAnalysis: true;
    qualityGates: string[];
  };
};

function wordsForVisualCue(text: string) {
  return (text.match(/[\p{L}]+/gu) ?? [])
    .filter((word) => word.length >= 4)
    .slice(0, 3);
}

function paceForBeat(beat: TtsReferenceScript["beats"][number]): LessonSegment["pace"] {
  if (beat.pitchContour === "build") return "build";
  if (beat.relativeRate >= 1.1 || beat.targetWpm >= 150) return "fast";
  if (beat.relativeRate <= 0.84 || beat.targetWpm <= 98) return "slow";
  return "steady";
}

function energyForBeat(beat: TtsReferenceScript["beats"][number]): LessonSegment["energy"] {
  if (beat.intensity === "very_low" || beat.intensity === "low") return "low";
  if (beat.intensity === "high" || beat.intensity === "projected") return "high";
  if (beat.intensity === "medium") return "medium";
  return "contained";
}

function intonationForBeat(beat: TtsReferenceScript["beats"][number]): IntonationShape {
  const shapeMap: Record<TtsReferenceScript["beats"][number]["pitchContour"], IntonationShape> = {
    low_flat: "low_flat",
    fall: "fall",
    rise: "rise",
    rise_fall: "rise_fall",
    suspension: "low_rise",
    wave: "rise_fall",
    build: "build",
  };
  return shapeMap[beat.pitchContour];
}

function categoryForScript(script: TtsReferenceScript): Lesson["category"] {
  if (script.specialty === "Short dynamique") return "Hook";
  if (script.specialty === "Publicite UGC") return "Publicite";
  if (script.specialty === "Film serie" || script.specialty === "Animation dessin anime" || script.specialty === "Jeu video") return "Doublage";
  if (script.specialty === "Horreur suspense") return "Emotion";
  return "Narration";
}

function toLesson(script: TtsReferenceScript, reference?: ApprovedReferenceAudio): Lesson {
  return {
    id: `prompter-${script.id}`,
    world: script.specialty,
    title: script.title,
    domain: script.specialty,
    category: categoryForScript(script),
    emotion: script.directorsNotes.performance,
    scenario: script.scene,
    level: script.level,
    xp: 18 + script.level * 7,
    targetWpm: Math.round(script.beats.reduce((total, beat) => total + beat.targetWpm, 0) / script.beats.length),
    objective: script.objective,
    coachTip: script.directorsNotes.pacing,
    focusPoints: script.skills,
    successCriteria: ["Texte fidèle", "Rythme et silences", "Intention compréhensible"],
    referenceAudio: reference
      ? {
          status: "licensed",
          title: `Référence TTS contrôlée · ${script.title}`,
          localPath: reference.localPath,
          license: reference.license,
          exactText: true,
        }
      : {
          status: "commission_required",
          title: `Référence TTS à produire · ${script.title}`,
          exactText: true,
        },
    segments: script.beats.map((beat) => {
      const cueWords = wordsForVisualCue(beat.text);
      const timings = reference?.wordTimingsByBeat[beat.id];
      const firstTiming = timings?.[0];
      const lastTiming = timings?.at(-1);
      const energy = energyForBeat(beat);
      return {
        text: beat.text,
        pauseAfterMs: beat.pauseAfterMs,
        referenceSpeechDurationMs: firstTiming && lastTiming ? lastTiming.endMs - firstTiming.startMs : undefined,
        referenceWordTimings: timings,
        timingSource: reference ? "professional_reference" : "research_profile",
        pace: paceForBeat(beat),
        energy,
        intonation: intonationForBeat(beat),
        accelerateWords: beat.accelerate ? cueWords : [],
        louderWords: beat.visualScale > 1 || energy === "high" ? cueWords.slice(-1) : [],
        softerWords: beat.visualScale < 1 || energy === "low" ? cueWords.slice(-1) : [],
        emphasis: cueWords.slice(-1),
        note: beat.intent,
        deliveryCue: `${beat.tags.join(" ")} ${beat.intent}`.trim(),
      };
    }),
  };
}

export function createPrompterExercise(scriptId: string): PrompterExerciseModel {
  const script = getTtsScriptById(scriptId);
  if (!script) throw new Error(`Script d'exercice introuvable : ${scriptId}`);
  const profile = getTtsProfileById(script.profileId);
  if (!profile) throw new Error(`Profil vocal introuvable : ${script.profileId}`);

  const pending: PrompterExerciseModel = {
    id: `prompter-${script.id}`,
    kind: "guided-prompter-imitation",
    script,
    profile,
    lesson: toLesson(script),
    reference: {
      state: "awaiting_tts_audio",
      geminiPrompt: buildGeminiTtsPrompt(script, profile),
      expectedDurationSeconds: script.targetDurationSeconds,
      canPlayExample: false,
      canValidateForProgress: false,
    },
    evaluation: {
      passThreshold: script.passThreshold,
      scoringWeights: script.scoringWeights,
      requiresExactTranscript: true,
      requiresPhonemeAlignment: true,
      requiresAcousticAnalysis: true,
      qualityGates: script.qualityGates,
    },
  };
  const approved = getApprovedReferenceAudio(scriptId);
  return approved ? attachApprovedReferenceAudio(pending, approved) : pending;
}

export function attachApprovedReferenceAudio(
  model: PrompterExerciseModel,
  reference: ApprovedReferenceAudio,
): PrompterExerciseModel {
  const [minimumSeconds, maximumSeconds] = model.script.targetDurationSeconds;
  if (!Number.isFinite(reference.durationSeconds) || reference.durationSeconds < minimumSeconds || reference.durationSeconds > maximumSeconds) {
    throw new Error(
      `${model.id}: durée réelle ${reference.durationSeconds}s hors contrat (${minimumSeconds}-${maximumSeconds}s).`,
    );
  }
  for (const beat of model.script.beats) {
    const timings = reference.wordTimingsByBeat[beat.id];
    if (!timings?.length) throw new Error(`${model.id}: timestamps manquants pour ${beat.id}.`);
    if (timings.some((timing) => timing.endMs <= timing.startMs || timing.startMs < 0)) {
      throw new Error(`${model.id}: timestamps invalides pour ${beat.id}.`);
    }
  }
  if (
    reference.mfa.wordAlignment !== "mfa"
    || reference.mfa.phonemeAlignment !== "mfa"
    || reference.mfa.phoneConfidence !== "mfa-phone-confidence"
    || !reference.mfa.validatedAt
  ) {
    throw new Error(`${model.id}: référence interdite sans alignement MFA phonétique validé.`);
  }

  return {
    ...model,
    lesson: toLesson(model.script, reference),
    reference: {
      ...model.reference,
      state: "ready",
      canPlayExample: true,
      canValidateForProgress: true,
      humanReviewedAt: reference.humanReviewedAt,
    },
  };
}

export function assertPrompterExerciseModel(model: PrompterExerciseModel) {
  if (model.lesson.segments.length !== model.script.beats.length) throw new Error(`${model.id}: beats incomplets.`);
  if (model.evaluation.passThreshold !== model.script.passThreshold) throw new Error(`${model.id}: seuil incohérent.`);
  if (Object.values(model.evaluation.scoringWeights).reduce((total, weight) => total + weight, 0) !== 100) {
    throw new Error(`${model.id}: pondération invalide.`);
  }
  for (const [index, segment] of model.lesson.segments.entries()) {
    const sourceBeat = model.script.beats[index];
    if (!sourceBeat || segment.text !== sourceBeat.text) throw new Error(`${model.id}: texte du prompteur modifié.`);
    if (segment.pauseAfterMs !== sourceBeat.pauseAfterMs) throw new Error(`${model.id}: silence du prompteur modifié.`);
    if (model.reference.state === "ready" && (!segment.referenceWordTimings?.length || segment.timingSource !== "professional_reference")) {
      throw new Error(`${model.id}: référence approuvée sans timestamps réels.`);
    }
  }
  if (model.reference.state !== "ready" && model.reference.canValidateForProgress) {
    throw new Error(`${model.id}: validation interdite sans référence contrôlée.`);
  }
  return model;
}
