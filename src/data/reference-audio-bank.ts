import { getApprovedReferenceAudio } from "./approved-reference-audio";
import { ttsReferenceScripts } from "./tts-reference-corpus";
import type { TtsReferenceScript, TtsSpecialty } from "../lib/tts-corpus";

export type ReferenceVoiceFamily = "feminine" | "masculine";

export type ReferenceAudioProductionStage =
  | "approved"
  | "needs_tts_generation"
  | "needs_duration_review"
  | "needs_human_review"
  | "needs_mfa_alignment"
  | "needs_publication";

export type ReferenceAudioProductionJob = {
  id: string;
  scriptId: string;
  title: string;
  specialty: TtsSpecialty;
  level: TtsReferenceScript["level"];
  exerciseRole: TtsReferenceScript["exerciseRole"];
  requestedVoiceFamily: ReferenceVoiceFamily;
  geminiVoice: TtsReferenceScript["voice"]["primary"];
  targetDurationSeconds: [number, number];
  stage: ReferenceAudioProductionStage;
  approvedAudioPath?: string;
  publicationGates: string[];
};

const voiceFamilies: ReferenceVoiceFamily[] = ["feminine", "masculine"];

function voiceForFamily(script: TtsReferenceScript, family: ReferenceVoiceFamily) {
  if (family === "feminine") return script.voice.alternates[0] ?? script.voice.primary;
  return script.voice.primary;
}

function stageForScript(script: TtsReferenceScript): ReferenceAudioProductionStage {
  return getApprovedReferenceAudio(script.id) ? "approved" : "needs_tts_generation";
}

export const referenceAudioProductionJobs: ReferenceAudioProductionJob[] = ttsReferenceScripts.flatMap((script) => {
  const approved = getApprovedReferenceAudio(script.id);
  return voiceFamilies.map((family) => ({
    id: `${script.id}-${family}`,
    scriptId: script.id,
    title: script.title,
    specialty: script.specialty,
    level: script.level,
    exerciseRole: script.exerciseRole,
    requestedVoiceFamily: family,
    geminiVoice: voiceForFamily(script, family),
    targetDurationSeconds: script.targetDurationSeconds,
    stage: approved ? family === "masculine" ? stageForScript(script) : "needs_tts_generation" : "needs_tts_generation",
    approvedAudioPath: approved && family === "masculine" ? approved.localPath : undefined,
    publicationGates: [
      "Gemini TTS avec balises d'intention du script",
      "Duree reelle dans le contrat pedagogique",
      "Ecoute humaine sans artefact ni jeu caricatural",
      "Transcription exacte du texte attendu",
      "Alignement MFA mots et phonemes",
      "Phone-goodness MFA exploitable pour la notation",
      "Timings injectes dans le prompteur avant affichage",
    ],
  }));
});

export const referenceAudioBankStats = {
  scriptCount: ttsReferenceScripts.length,
  requiredVoiceFamilies: voiceFamilies.length,
  productionJobCount: referenceAudioProductionJobs.length,
  approvedJobCount: referenceAudioProductionJobs.filter((job) => job.stage === "approved").length,
  pendingJobCount: referenceAudioProductionJobs.filter((job) => job.stage !== "approved").length,
  specialtyCount: new Set(referenceAudioProductionJobs.map((job) => job.specialty)).size,
  estimatedDurationSeconds: referenceAudioProductionJobs.reduce(
    (total, job) => total + (job.targetDurationSeconds[0] + job.targetDurationSeconds[1]) / 2,
    0,
  ),
};

export function jobsForSpecialty(specialty: TtsSpecialty) {
  return referenceAudioProductionJobs.filter((job) => job.specialty === specialty);
}
