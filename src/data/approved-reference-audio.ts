import type { ApprovedReferenceAudio } from "../lib/exercise-model";

/**
 * References that passed the complete VoiceAct publication gate:
 * human listening review, final-file duration check, MFA word/phone alignment
 * and MFA phone-goodness coverage.  Do not add generated candidates here.
 */
const approvedReferenceAudio: Record<string, ApprovedReferenceAudio> = {
  "short-01-anomalie": {
    localPath: "/voiceact/reference-audio/short-01-anomalie-puck.wav",
    license: "Synthèse Gemini interne contrôlée · exemple pédagogique",
    humanReviewedAt: "2026-07-28T00:00:00.000Z",
    durationSeconds: 9.76,
    mfa: {
      wordAlignment: "mfa",
      phonemeAlignment: "mfa",
      phoneConfidence: "mfa-phone-confidence",
      validatedAt: "2026-07-29T02:55:00.000Z",
    },
    wordTimingsByBeat: {
      hook: [
        { word: "Cet", startMs: 280, endMs: 640 },
        { word: "ascenseur", startMs: 640, endMs: 1220 },
        { word: "dessert", startMs: 1220, endMs: 1620 },
        { word: "trente", startMs: 1720, endMs: 2160 },
        { word: "étages", startMs: 2160, endMs: 2450 },
        { word: "mais", startMs: 2770, endMs: 2930 },
        { word: "il", startMs: 2930, endMs: 3060 },
        { word: "refuse", startMs: 3060, endMs: 3470 },
        { word: "toujours", startMs: 3600, endMs: 4010 },
        { word: "le", startMs: 4010, endMs: 4080 },
        { word: "même", startMs: 4080, endMs: 4310 },
        { word: "bouton", startMs: 4310, endMs: 4620 },
      ],
      detail: [
        { word: "Le", startMs: 5460, endMs: 5640 },
        { word: "treizième", startMs: 5640, endMs: 6220 },
      ],
      promise: [
        { word: "Et", startMs: 7070, endMs: 7140 },
        { word: "quand", startMs: 7140, endMs: 7480 },
        { word: "on", startMs: 7480, endMs: 7550 },
        { word: "a", startMs: 7550, endMs: 7630 },
        { word: "forcé", startMs: 7630, endMs: 7910 },
        { word: "la", startMs: 7960, endMs: 8140 },
        { word: "porte", startMs: 8140, endMs: 8420 },
        { word: "on", startMs: 8470, endMs: 8590 },
        { word: "a", startMs: 8590, endMs: 8670 },
        { word: "compris", startMs: 8670, endMs: 9070 },
        { word: "pourquoi", startMs: 9110, endMs: 9460 },
      ],
    },
  },
};

export function getApprovedReferenceAudio(scriptId: string): ApprovedReferenceAudio | undefined {
  return approvedReferenceAudio[scriptId];
}
