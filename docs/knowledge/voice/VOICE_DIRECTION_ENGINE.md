# Voice Direction Engine — spécification fonctionnelle

## Mission

Transformer un texte et une intention en partition vocale horodatée, guider l'utilisateur pendant la prise, puis comparer sa performance à cette partition.

Le moteur ne doit pas inférer l'état émotionnel intérieur de l'utilisateur. Il mesure des caractéristiques observables et leur correspondance avec une cible de jeu.

## 1. Entrées

- langue et variante ;
- discipline : doublage, hook, corps, conclusion, documentaire, actualité, publicité ;
- intention de jeu ;
- niveau de l'apprenant ;
- texte ;
- référence audio optionnelle ;
- durée vidéo ou contraintes labiales optionnelles ;
- profil de débit personnel issu du diagnostic.

## 2. Unités de la partition

```ts
type CueKind = "speech" | "silence" | "breath" | "vocalization";

type VoiceCue = {
  id: string;
  kind: CueKind;
  text?: string;
  vocalization?: "hmm" | "pff" | "gasp" | "laugh" | "sob" | "swallow";
  intention: string;
  startMs: number;
  endMs: number;
  toleranceMs: number;
  targetRate?: {
    syllablesPerSecond: number;
    min: number;
    max: number;
  };
  targetEnergy?: "very_low" | "low" | "medium" | "high" | "burst";
  pitchContour?: "flat_low" | "rise" | "fall" | "rise_fall" | "build" | "break";
  emphasis?: string[];
  voiceQuality?: ("breathy" | "clear" | "tense" | "warm" | "dark" | "smiling")[];
};
```

## 3. Construction temporelle

### Avec référence professionnelle

1. transcription verbatim ;
2. alignement forcé mot/phonème ;
3. détection des segments vocaux et silences ;
4. extraction F0, énergie et qualité vocale ;
5. regroupement des mots en intentions de phrase ;
6. validation humaine de la partition.

Les timestamps de la référence sont prioritaires. Le moteur ne les remplace pas par une moyenne WPM.

### Sans référence

1. segmenter syntaxiquement le texte ;
2. produire les groupes de sens ;
3. estimer les syllabes prononcées, y compris schwas et liaisons probables ;
4. appliquer le profil de genre et d'intention ;
5. ajouter les pauses de ponctuation ;
6. modifier les durées autour des mots accentués ;
7. réserver les événements non verbaux ;
8. générer la géométrie du prompteur.

Formule initiale :

```text
durée_parole = syllabes_prononcées / débit_syllabique_cible
durée_segment = durée_parole + somme(événements et pauses)
```

Le nombre de mots n'est utilisé que comme estimation de secours.

## 4. Géométrie du prompteur

- une échelle temporelle unique, par exemple 100 pixels par seconde ;
- largeur d'un segment = durée réelle × échelle ;
- aucune largeur minimale ne doit modifier le temps ;
- si un segment est trop étroit, réduire ou masquer ses métadonnées, pas agrandir artificiellement sa durée ;
- la ligne rouge reste fixe à gauche ;
- les phrases avancent de droite à gauche selon une horloge monotone ;
- `requestAnimationFrame` et `performance.now()` pilotent l'animation ;
- React ne doit pas recalculer toute la bande 20 fois par seconde ; la translation visuelle peut utiliser une variable CSS ou Web Animation.

La phrase reste l'unité lisible. Des ancres invisibles peuvent positionner les mots importants dans la phrase sans transformer l'interface en karaoke.

## 5. Encodage visuel

- taille du texte : énergie attendue ;
- position verticale légère : hauteur relative, sans dépasser la bande ;
- épaisseur : accentuation ;
- couleur secondaire : qualité vocale ou intention ;
- espace vide : silence ;
- symbole respiratoire : souffle ;
- courbe simple : contour de F0 ;
- trait sous la phrase : durée parlée ;
- zone grisée après la phrase : durée du silence.

Une seule variable visuelle ne doit pas représenter deux paramètres différents.

## 6. Analyse de la prise

Pipeline cible :

1. contrôle du micro et du bruit ;
2. VAD pour segments parlés et silences ;
3. ASR verbatim ;
4. alignement forcé avec le texte attendu ;
5. durée par mot, syllabe et groupe de sens ;
6. F0 normalisée par rapport à la tessiture personnelle ;
7. énergie relative, attaque et relâchement ;
8. eGeMAPS pour descripteurs acoustiques standardisés ;
9. comparaison temporelle par segment ;
10. génération de deux retours maximum avant une nouvelle prise.

Outils de référence :

- [Praat](https://praat.org/) pour valider pitch, intensité, jitter, shimmer et HNR ;
- [openSMILE](https://audeering.github.io/opensmile/) et [GeMAPS](https://doi.org/10.1109/TAFFC.2015.2457417) pour un jeu standard de paramètres ;
- [Montreal Forced Aligner](https://montreal-forced-aligner.readthedocs.io/) pour l'alignement ;
- [WhisperX](https://arxiv.org/abs/2303.00747) comme piste ASR + VAD + alignement, à tester spécifiquement en français.

## 7. Score

Le score doit être calculé segment par segment avant agrégation.

Proposition diagnostic :

| Dimension | Poids initial |
|---|---:|
| Respect du texte / intelligibilité | 20 % |
| Timing des groupes de sens | 20 % |
| Placement et durée des pauses | 20 % |
| Courbe de hauteur relative | 15 % |
| Énergie et dynamique | 15 % |
| Accents et mots pivots | 10 % |

Les poids changent selon l'exercice. Un exercice de silence dramatique augmente le poids des pauses ; un hook rapide augmente le poids du timing et de l'articulation.

Chaque score doit fournir :

- valeur ;
- confiance de mesure ;
- erreur principale ;
- action suivante ;
- tolérance liée au niveau.

Une mesure de faible confiance ne doit pas faire échouer l'utilisateur.

## 8. Personnalisation

Le diagnostic initial crée une base personnelle :

- débit confortable ;
- étendue de F0 réellement utilisable ;
- énergie médiane ;
- durée moyenne des pauses ;
- stabilité du micro ;
- articulation et omissions fréquentes.

Le cursus compare ensuite l'utilisateur à deux références : la cible professionnelle et sa propre progression. Cela évite de pénaliser les différences naturelles de voix tout en maintenant l'objectif de jeu.

## 9. Validation des exercices

Un exercice ne passe en production que si :

1. le texte et l'audio sont juridiquement exploitables ;
2. un directeur artistique ou comédien valide l'intention ;
3. les timestamps sont contrôlés manuellement ;
4. trois à cinq professionnels produisent des prises de référence ;
5. les tolérances couvrent leurs variations légitimes ;
6. un groupe de débutants comprend les indications sans explication externe ;
7. le score automatique corrèle avec des évaluations humaines ;
8. aucun retour ne prétend diagnostiquer un état psychologique.
