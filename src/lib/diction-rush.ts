import type { Lesson, LessonSegment } from "./types";

export type DictionRushDrill = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  text: string;
  targetPhones: string[];
  focus: string;
  cue: string;
  targetWpm: number;
  energy: LessonSegment["energy"];
  pace: LessonSegment["pace"];
  intonation: LessonSegment["intonation"];
  passScore: number;
};

export const dictionRushDrills: DictionRushDrill[] = [
  { id: "rush-nasales-1", level: 1, title: "Nasales propres", text: "Mon nom sonne dans la maison.", targetPhones: ["ɔ̃", "ɑ̃", "n", "m"], focus: "Garder les nasales rondes sans avaler la fin.", cue: "Ralentis légèrement sur mon, nom, sonne, maison.", targetWpm: 105, energy: "medium", pace: "steady", intonation: "low_flat", passScore: 66 },
  { id: "rush-r-1", level: 1, title: "Le R qui accroche", text: "Regarde la route rouge.", targetPhones: ["ʁ", "u", "ʒ"], focus: "Faire entendre le /r/ sans le durcir.", cue: "Attaque chaque r proprement, puis garde la phrase fluide.", targetWpm: 112, energy: "medium", pace: "steady", intonation: "rise", passScore: 68 },
  { id: "rush-finales-1", level: 1, title: "Fins nettes", text: "Chaque petite porte claque sec.", targetPhones: ["ʃ", "t", "k", "s"], focus: "Fermer les consonnes finales sans ajouter de voyelle.", cue: "La dernière consonne doit rester courte et nette.", targetWpm: 118, energy: "contained", pace: "steady", intonation: "fall", passScore: 68 },
  { id: "rush-sifflantes-1", level: 1, title: "Sifflantes propres", text: "Six scènes se succèdent sans silence.", targetPhones: ["s", "z"], focus: "Différencier les /s/ secs et les /z/ vibrés.", cue: "Garde la langue stable, sans souffler trop fort.", targetWpm: 125, energy: "medium", pace: "steady", intonation: "build", passScore: 70 },
  { id: "rush-liaisons-2", level: 2, title: "Liaison rapide", text: "Les anciens amis arrivent ensemble.", targetPhones: ["z", "ɑ̃", "m"], focus: "Relier les mots sans brouiller les attaques.", cue: "La liaison doit glisser, pas disparaître.", targetWpm: 135, energy: "contained", pace: "fast", intonation: "rise_fall", passScore: 72 },
  { id: "rush-b-d-g-2", level: 2, title: "Consonnes sonores", text: "Bruno garde deux grandes bagues.", targetPhones: ["b", "d", "ɡ", "ʁ"], focus: "Garder la vibration sur b, d, g.", cue: "Pose les attaques, mais ne casse pas le rythme.", targetWpm: 122, energy: "medium", pace: "steady", intonation: "low_flat", passScore: 72 },
  { id: "rush-virelangue-2", level: 2, title: "Mini virelangue", text: "Trois trains très tristes traversent Tours.", targetPhones: ["t", "ʁ", "s"], focus: "Garder l'articulation quand les attaques se répètent.", cue: "Ne te précipite pas sur trois trains très tristes.", targetWpm: 128, energy: "contained", pace: "fast", intonation: "build", passScore: 74 },
  { id: "rush-urgence-3", level: 3, title: "Diction sous pression", text: "Dernière alerte, la ville ferme dans cinq minutes.", targetPhones: ["d", "ʁ", "v", "s", "t"], focus: "Parler vite sans perdre les consonnes.", cue: "Accélère, mais garde dernière, ville, cinq très lisibles.", targetWpm: 155, energy: "high", pace: "fast", intonation: "build", passScore: 76 },
  { id: "rush-menace-3", level: 3, title: "Menace basse", text: "Tu souris, mais je sais très bien pourquoi.", targetPhones: ["s", "ʁ", "j", "p"], focus: "Rester bas, clair et contrôlé.", cue: "La menace vient de la précision, pas du volume.", targetWpm: 95, energy: "low", pace: "slow", intonation: "fall", passScore: 76 },
  { id: "rush-boss-3", level: 3, title: "Boss diction", text: "Cette histoire commence quand chacun comprend enfin son erreur.", targetPhones: ["ʃ", "k", "ɑ̃", "ɔ̃", "ʁ"], focus: "Enchaîner plusieurs familles de sons dans une phrase complète.", cue: "Respire avant, puis lis d'un seul geste propre.", targetWpm: 138, energy: "contained", pace: "build", intonation: "rise_fall", passScore: 78 },
];

export function dictionDrillToLesson(drill: DictionRushDrill): Lesson {
  return {
    id: `diction-${drill.id}`,
    world: "Diction Rush",
    title: drill.title,
    domain: "Jeu diction",
    category: "Narration",
    emotion: "Précision ludique",
    scenario: drill.focus,
    level: drill.level,
    xp: 12 + drill.level * 4,
    targetWpm: drill.targetWpm,
    objective: drill.focus,
    coachTip: drill.cue,
    focusPoints: drill.targetPhones.map((phone) => `/${phone}/`),
    successCriteria: ["Sons cibles nets", "Phrase complète", "Rythme proche de la cible"],
    segments: [{ text: drill.text, pauseAfterMs: 420, pace: drill.pace, energy: drill.energy, intonation: drill.intonation, emphasis: drill.targetPhones, note: drill.focus, deliveryCue: drill.cue }],
  };
}
