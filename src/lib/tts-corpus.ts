export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview" as const;

export type GeminiVoiceName =
  | "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" | "Leda"
  | "Orus" | "Aoede" | "Callirrhoe" | "Autonoe" | "Enceladus"
  | "Iapetus" | "Umbriel" | "Algieba" | "Despina" | "Erinome"
  | "Algenib" | "Rasalgethi" | "Laomedeia" | "Achernar"
  | "Alnilam" | "Schedar" | "Gacrux" | "Pulcherrima" | "Achird"
  | "Zubenelgenubi" | "Vindemiatrix" | "Sadachbia"
  | "Sadaltager" | "Sulafat";

export type TtsSpecialty =
  | "Short dynamique"
  | "Video longue storytelling"
  | "Actualite journalisme"
  | "Horreur suspense"
  | "Publicite UGC"
  | "Film serie"
  | "Animation dessin anime"
  | "Jeu video";

export type TtsSkill =
  | "articulation"
  | "timing"
  | "pace"
  | "pauses"
  | "intonation"
  | "intensity"
  | "emotion"
  | "synchronization"
  | "character_consistency"
  | "breath_control";

export type TtsVoiceProfile = {
  id: string;
  name: string;
  archetype: string;
  vocalIdentity: string;
  defaultVoice: GeminiVoiceName;
  alternateVoices: GeminiVoiceName[];
  voiceSelectionNote: string;
  globalDirection: string;
  safety: string;
};

export type TtsDirectionBeat = {
  id: string;
  tags: string[];
  text: string;
  intent: string;
  targetWpm: number;
  relativeRate: number;
  intensity: "very_low" | "low" | "medium" | "high" | "projected";
  pitchContour: "low_flat" | "fall" | "rise" | "rise_fall" | "suspension" | "wave" | "build";
  pauseAfterMs: number;
  visualScale: number;
  accelerate: boolean;
  scoringFocus: TtsSkill[];
};

export type TtsReferenceScript = {
  id: string;
  title: string;
  specialty: TtsSpecialty;
  level: 1 | 2 | 3 | 4;
  exerciseRole: "foundation" | "contrast" | "challenge" | "boss";
  format: string;
  objective: string;
  skills: TtsSkill[];
  targetDurationSeconds: [number, number];
  profileId: string;
  voice: {
    primary: GeminiVoiceName;
    alternates: GeminiVoiceName[];
    rationale: string;
    requiresListeningValidation: true;
  };
  scene: string;
  directorsNotes: {
    performance: string;
    pacing: string;
    articulation: string;
    breathing: string;
    dynamics: string;
    pitch: string;
    avoid: string;
  };
  sampleContext: string;
  beats: TtsDirectionBeat[];
  passThreshold: number;
  scoringWeights: Record<TtsSkill, number>;
  qualityGates: string[];
};

export function buildGeminiTtsPrompt(
  script: TtsReferenceScript,
  profile: TtsVoiceProfile,
) {
  const plainTranscript = script.beats
    .map((beat) => beat.text)
    .join("\n");
  const performanceMap = script.beats
    .map((beat, index) => [
      `Line ${index + 1} silent acting tags: ${beat.tags.join(" ")}`,
      `   Intention: ${beat.intent}`,
      `   Target pace: ${beat.targetWpm} WPM; relative rate ${beat.relativeRate.toFixed(2)}.`,
      `   Vocal size: ${beat.intensity}; pitch contour: ${beat.pitchContour}.`,
      `   Required pause after this sentence: ${beat.pauseAfterMs} ms.`,
    ].join("\n"))
    .join("\n");
  const expectedWords = script.beats.reduce((total, beat) => total + countWords(beat.text), 0);

  return [
    `# AUDIO PROFILE: ${profile.name}`,
    `Archetype: ${profile.archetype}`,
    `Vocal identity: ${profile.vocalIdentity}`,
    `Global direction: ${profile.globalDirection}`,
    `Safety: ${profile.safety}`,
    "",
    `# THE SCENE: ${script.title}`,
    script.scene,
    "",
    "# DIRECTOR'S NOTES",
    `Target final duration: ${script.targetDurationSeconds[0]} to ${script.targetDurationSeconds[1]} seconds. ` +
      "Honor pauses as real silence; do not compress dramatic rests. If you are below the minimum duration, slow down and lengthen the marked silences instead of deleting text.",
    `Expected spoken length: ${expectedWords} words. Read every word exactly once.`,
    "Verbatim rule: do not paraphrase, summarize, simplify, translate, modernize numbers, remove punctuation meaning, or omit final clauses.",
    "If a line contains a time, number, percentage, name, quote, or warning, keep the meaning exactly as written.",
    "Intelligibility rule: even when acting fear, secrecy, weakness, whisper, or suspense, keep studio-clear diction. Do not mumble, distort, swallow syllables, or bury words under breath.",
    `Performance: ${script.directorsNotes.performance}`,
    `Pacing: ${script.directorsNotes.pacing}`,
    `Articulation: ${script.directorsNotes.articulation}`,
    `Breathing: ${script.directorsNotes.breathing}`,
    `Dynamics: ${script.directorsNotes.dynamics}`,
    `Pitch: ${script.directorsNotes.pitch}`,
    `Avoid: ${script.directorsNotes.avoid}`,
    "",
    "# SAMPLE CONTEXT",
    script.sampleContext,
    "",
    "# SILENT PERFORMANCE MAP - DO NOT READ THIS HEADING OR THE NOTES",
    performanceMap,
    "",
    "# VERBATIM SPOKEN TRANSCRIPT",
    "Read only the following transcript aloud, exactly once, in French. The transcript lines are the only spoken content:",
    plainTranscript,
  ].join("\n");
}

function countWords(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean).length;
}

export function estimateTtsScriptDurationSeconds(script: TtsReferenceScript) {
  const speechSeconds = script.beats.reduce((total, beat) => {
    const words = countWords(beat.text);
    const spokenSeconds = (words / Math.max(60, beat.targetWpm)) * 60;
    return total + spokenSeconds + beat.pauseAfterMs / 1_000;
  }, 0);
  // Gemini TTS tends to compress explicit direction and pauses. The range below
  // is a realistic generation contract, not a human studio performance promise.
  const minimum = Math.max(1.5, Math.floor(speechSeconds * 0.78 * 10) / 10);
  const maximum = Math.ceil(speechSeconds * 1.18 * 10) / 10;
  return {
    words: script.beats.reduce((total, beat) => total + countWords(beat.text), 0),
    plannedSeconds: Number(speechSeconds.toFixed(2)),
    suggested: [minimum, maximum] as [number, number],
  };
}

export function assertTtsCorpus(
  scripts: TtsReferenceScript[],
  profiles: TtsVoiceProfile[],
) {
  const expectedSpecialties: TtsSpecialty[] = [
    "Short dynamique",
    "Video longue storytelling",
    "Actualite journalisme",
    "Horreur suspense",
    "Publicite UGC",
    "Film serie",
    "Animation dessin anime",
    "Jeu video",
  ];
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const scriptIds = new Set<string>();
  const durationErrors: string[] = [];

  for (const specialty of expectedSpecialties) {
    const specialtyScripts = scripts.filter((script) => script.specialty === specialty);
    if (specialtyScripts.length < 4) {
      throw new Error(`${specialty} doit contenir au moins 4 scripts progressifs.`);
    }
    const levels = new Set(specialtyScripts.map((script) => script.level));
    if ([1, 2, 3, 4].some((level) => !levels.has(level as 1 | 2 | 3 | 4))) {
      throw new Error(`${specialty} doit couvrir les niveaux 1 à 4.`);
    }
  }

  for (const script of scripts) {
    if (scriptIds.has(script.id)) throw new Error(`ID de script dupliqué: ${script.id}`);
    scriptIds.add(script.id);
    if (!profileIds.has(script.profileId)) {
      throw new Error(`Profil inconnu ${script.profileId} pour ${script.id}`);
    }
    if (script.beats.length < 2) throw new Error(`${script.id} manque de variations temporelles.`);
    const estimated = estimateTtsScriptDurationSeconds(script);
    const [targetMin, targetMax] = script.targetDurationSeconds;
    const [suggestedMin, suggestedMax] = estimated.suggested;
    const overlapsEstimate = targetMax >= suggestedMin && targetMin <= suggestedMax;
    if (!overlapsEstimate) {
      durationErrors.push(
        `${script.id}: contrat durée ${targetMin}-${targetMax}s incohérent avec texte/débit ` +
        `(estimation ${estimated.plannedSeconds}s, contrat réaliste ${suggestedMin}-${suggestedMax}s).`,
      );
    }
    const totalWeight = Object.values(script.scoringWeights).reduce((sum, value) => sum + value, 0);
    if (totalWeight !== 100) throw new Error(`${script.id}: pondération=${totalWeight}, attendu=100.`);
    for (const beat of script.beats) {
      if (!beat.tags.every((tag) => /^\[[a-z0-9 ,'-]+\]$/i.test(tag))) {
        throw new Error(`${script.id}/${beat.id}: balise Gemini invalide.`);
      }
      if (beat.relativeRate < 0.55 || beat.relativeRate > 1.55) {
        throw new Error(`${script.id}/${beat.id}: vitesse relative dangereuse ou irréaliste.`);
      }
      if (beat.visualScale < 0.82 || beat.visualScale > 1.24) {
        throw new Error(`${script.id}/${beat.id}: échelle visuelle excessive.`);
      }
      if (beat.pauseAfterMs < 0 || beat.pauseAfterMs > 1800) {
        throw new Error(`${script.id}/${beat.id}: pause hors limites.`);
      }
    }
  }
  if (durationErrors.length) {
    throw new Error(durationErrors.join("\n"));
  }
}
