# VoiceAct Knowledge Base

Cette base de connaissance sert a construire les exercices, les scores, les retours pedagogiques, la gamification et l'experience mobile de VoiceAct Studio.

Objectif : eviter de creer un coach vocal vague. Chaque exercice et chaque feedback doivent reposer sur :
- une logique pedagogique claire ;
- des principes de prosodie ;
- des contraintes de narration voix off ;
- des usages de doublage ;
- une experience mobile simple ;
- une gamification utile, pas decorative.

## Dossiers

- `voice/` : prosodie, pauses, intonation, rythme, energie, articulation.
- `domains/` : createur video, horreur, documentaire, actualite, motivation, divertissement, doublage.
- `product/` : UX mobile, gamification, metronome, courbe d'intonation, scoring.
- `sources/` : bibliographie, sources web, etudes, livres, ressources de reference.

## Documents de reference a lire en premier

- `voice/SPEECH_RATE_EVIDENCE.md` : ce que la recherche permet reellement de conclure sur debit, pauses, emotion et intelligibilite.
- `voice/VOICE_DIRECTION_ENGINE.md` : specification du moteur qui transforme un texte en partition vocale horodatee et qui calcule la note.
- `voice/TRAINING_EXERCISE_CATALOG.json` : catalogue structure des exercices reconnus, formats ludiques, mesures et garde-fous.
- `../17_CATALOGUE_EXERCICES_VOCAUX_RECONNUS.md` : version pedagogique detaillee des 32 exercices et de leurs niveaux de preuve.
- `../18_PARCOURS_15_JEUX_ET_BANQUES_AUDIO.md` : progression en 15 jeux, checkpoints au prompteur et banques audio classees par droits.
- `sources/CORPUS_CATALOG.md` : corpus audio/video classes selon langue, horodatage, emotion et licence.
- `sources/CORPUS_CATALOG.json` : version exploitable par le futur back-office d'import.
- `sources/CINEMA_CREATOR_REFERENCES.md` : references cinema et createurs, avec protocole d'analyse sans copie illicite.
- `sources/RIGHTS_PRIVACY_AI.md` : garde-fous droit d'auteur, donnees vocales et AI Act.

## Niveaux de preuve

- `A` : revue systematique, meta-analyse ou standard largement valide.
- `B` : etude empirique relue par les pairs ou corpus valide perceptivement.
- `C` : pratique professionnelle coherente mais encore peu validee scientifiquement.
- `H` : hypothese produit a mesurer dans VoiceAct avant generalisation.

Une valeur `H` ne doit jamais etre presentee a l'utilisateur comme une norme scientifique.

## Regle produit

VoiceAct ne doit pas seulement noter une voix.

Il doit guider l'utilisateur pendant l'exercice :
- ou ralentir ;
- ou faire une pause ;
- ou monter/descendre l'intonation ;
- ou mettre plus d'energie ;
- ou calmer l'energie ;
- ou refaire une prise avec un objectif simple.
