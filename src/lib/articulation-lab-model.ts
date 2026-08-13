import type { AnalysisResult, Lesson, LessonSegment } from "./types";

export type ArticulationSkill = "nasals" | "final-consonants" | "sibilants" | "liquids" | "clusters" | "tongue-twister";

export type ArticulationDrill = {
  id: string;
  level: 1 | 2 | 3;
  skill: ArticulationSkill;
  title: string;
  preparation: string;
  text: string;
  targetPhones: string[];
  targetWpm: number;
  cue: string;
  safeStopRule: string;
  passThreshold: number;
};

export type ArticulationLabModel = {
  id: "articulation-lab";
  kind: "phonetic-coaching-lab";
  safety: {
    noObjectsInMouth: true;
    stopOnPainOrStrain: true;
    preparationIsNotScored: true;
  };
  guide: {
    steps: [string, string, string];
  };
  drills: ArticulationDrill[];
};

export const articulationDrills: ArticulationDrill[] = [
  {
    id: "lab-nasals-1", level: 1, skill: "nasals", title: "Résonance nasale", preparation: "Humme doucement trois secondes, lèvres détendues.",
    text: "Mon oncle montre son nom à Manon.", targetPhones: ["m", "n", "ɔ̃", "ɑ̃"], targetWpm: 96,
    cue: "Laisse les nasales résonner, sans pousser dans le nez.", safeStopRule: "Arrête si la gorge serre ou si la mâchoire fatigue.", passThreshold: 66,
  },
  {
    id: "lab-finales-1", level: 1, skill: "final-consonants", title: "Fins nettes", preparation: "Pose la langue et desserre la mâchoire avant chaque reprise.",
    text: "Chaque porte claque, puis le sol tremble.", targetPhones: ["ʃ", "t", "k", "l"], targetWpm: 105,
    cue: "Ferme les consonnes finales, sans rajouter une voyelle.", safeStopRule: "Garde un volume confortable ; la précision ne demande pas de forcer.", passThreshold: 68,
  },
  {
    id: "lab-sifflantes-2", level: 2, skill: "sibilants", title: "S et Z distincts", preparation: "Souris légèrement, puis garde la langue immobile.",
    text: "Six soleils silencieux s'effacent sous les arbres.", targetPhones: ["s", "z"], targetWpm: 118,
    cue: "Fais glisser les s sans souffler fort ; garde les z vibrés.", safeStopRule: "Si tu sens de l'air froid ou une tension, ralentis avant de recommencer.", passThreshold: 70,
  },
  {
    id: "lab-liquides-2", level: 2, skill: "liquids", title: "R et L propres", preparation: "Laisse tomber les épaules et ouvre la bouche sans tirer les lèvres.",
    text: "Laura relit la lettre rouge de Laurent.", targetPhones: ["l", "ʁ"], targetWpm: 112,
    cue: "Le l reste léger ; le r est audible, jamais râpeux.", safeStopRule: "Ne cherche pas un r très grave ou très roulé : reste dans ta voix naturelle.", passThreshold: 72,
  },
  {
    id: "lab-groupes-3", level: 3, skill: "clusters", title: "Attaques groupées", preparation: "Lis une fois lentement en séparant les mots, sans enregistrer.",
    text: "Trois grands trains traversent Bruxelles très tôt.", targetPhones: ["t", "ʁ", "ɡ", "s"], targetWpm: 126,
    cue: "Garde chaque attaque lisible quand les consonnes se suivent.", safeStopRule: "La vitesse vient après la netteté. Reviens au niveau précédent si l'articulation se ferme.", passThreshold: 74,
  },
  {
    id: "lab-virelangue-3", level: 3, skill: "tongue-twister", title: "Virelangue contrôlé", preparation: "Respire normalement, puis choisis un débit que tu peux tenir sans grimace.",
    text: "Ces six saucissons sont si secs qu'on ne sait si c'en sont.", targetPhones: ["s", "z", "k", "ɔ̃"], targetWpm: 132,
    cue: "Commence propre. N'accélère que lorsque chaque son reste clair.", safeStopRule: "Deux reprises maximum de suite ; fais une pause si la langue ou la gorge se crispent.", passThreshold: 76,
  },
];

export const articulationLabModel: ArticulationLabModel = {
  id: "articulation-lab",
  kind: "phonetic-coaching-lab",
  safety: { noObjectsInMouth: true, stopOnPainOrStrain: true, preparationIsNotScored: true },
  guide: {
    steps: [
      "Fais la préparation une fois, sans note et sans chercher la vitesse.",
      "Enregistre ensuite une phrase courte : VoiceAct vérifie les sons et le texte réellement prononcés.",
      "Une seule correction prioritaire est donnée avant la reprise suivante.",
    ],
  },
  drills: articulationDrills,
};

function intonationForSkill(skill: ArticulationSkill): LessonSegment["intonation"] {
  if (skill === "tongue-twister" || skill === "clusters") return "build";
  if (skill === "nasals") return "low_flat";
  return "fall";
}

export function createArticulationLesson(drillId: string): Lesson {
  const drill = articulationDrills.find((item) => item.id === drillId);
  if (!drill) throw new Error(`Exercice d'articulation introuvable : ${drillId}`);
  return {
    id: `articulation-${drill.id}`,
    world: "Articulation Lab",
    title: drill.title,
    domain: "Technique vocale",
    category: "Narration",
    emotion: "Précision calme",
    scenario: drill.preparation,
    level: drill.level,
    xp: 12 + drill.level * 5,
    targetWpm: drill.targetWpm,
    objective: drill.cue,
    coachTip: drill.safeStopRule,
    focusPoints: drill.targetPhones.map((phone) => `/${phone}/`),
    successCriteria: ["Phrase fidèle", "Sons cibles identifiables", "Débit confortable"],
    segments: [{
      text: drill.text,
      pauseAfterMs: 500,
      timingSource: "research_profile",
      pace: drill.level === 3 ? "fast" : "steady",
      energy: "contained",
      intonation: intonationForSkill(drill.skill),
      emphasis: drill.targetPhones,
      note: drill.cue,
      deliveryCue: drill.cue,
    }],
  };
}

export function didPassArticulationDrill(drill: ArticulationDrill, analysis: Pick<AnalysisResult, "analysisStatus" | "canValidate" | "globalScore" | "pronunciation" | "wordAccuracyPercent"> | null) {
  return Boolean(
    analysis
    && analysis.analysisStatus === "scored"
    && analysis.canValidate
    && analysis.pronunciation?.canValidate
    && (analysis.wordAccuracyPercent ?? 0) >= 80
    && analysis.globalScore >= drill.passThreshold,
  );
}

export function isArticulationDrillUnlocked(index: number, passedDrillIds: Set<string>) {
  if (index <= 0) return true;
  const previous = articulationDrills[index - 1];
  return Boolean(previous && passedDrillIds.has(previous.id));
}

export function assertArticulationLabModel(model: ArticulationLabModel = articulationLabModel) {
  if (!model.safety.noObjectsInMouth || !model.safety.stopOnPainOrStrain || !model.safety.preparationIsNotScored) {
    throw new Error("Articulation Lab : règle de sécurité manquante.");
  }
  if (model.drills.length < 6) throw new Error("Articulation Lab : progression insuffisante.");
  for (const drill of model.drills) {
    if (drill.targetPhones.length < 2 || !drill.text.trim()) throw new Error(`${drill.id}: contenu phonétique insuffisant.`);
    if (drill.passThreshold < 60 || drill.passThreshold > 85) throw new Error(`${drill.id}: seuil irréaliste.`);
    if (!drill.safeStopRule.trim()) throw new Error(`${drill.id}: consigne de sécurité absente.`);
  }
  return model;
}
