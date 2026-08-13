# VoiceAct — corpus de références Gemini TTS

Version : 1.0 — 24 juillet 2026

## État vérifié

- Aucune clé `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` n'est actuellement disponible dans le processus, les variables Windows utilisateur/machine ou les fichiers `.env*` du projet.
- Le modèle retenu est `gemini-3.1-flash-tts-preview`.
- Le mode gratuit ne doit recevoir que des scripts fictifs et non sensibles : Google indique que les contenus du free tier peuvent être utilisés pour améliorer ses produits.
- La clé sera conservée côté serveur uniquement. Elle ne doit jamais être placée dans une variable `NEXT_PUBLIC_*`.

## Volume 1 livré

La base exécutable se trouve dans :

- `src/lib/tts-corpus.ts` : contrat de données, validation et constructeur de prompt ;
- `src/data/tts-voice-profiles.ts` : huit profils de jeu ;
- `src/data/tts-reference-scripts-creator.ts` : vingt scripts créateur ;
- `src/data/tts-reference-scripts-dubbing.ts` : douze scripts doublage ;
- `src/data/tts-reference-corpus.ts` : catalogue unifié et fonctions d'accès.

Le volume comprend :

| Spécialité | Niveaux | Scripts |
|---|---:|---:|
| Short dynamique | 1 à 4 | 4 |
| Vidéo longue storytelling | 1 à 4 | 4 |
| Actualité journalisme | 1 à 4 | 4 |
| Horreur suspense | 1 à 4 | 4 |
| Publicité UGC | 1 à 4 | 4 |
| Film et série | 1 à 4 | 4 |
| Animation et dessin animé | 1 à 4 | 4 |
| Jeu vidéo | 1 à 4 | 4 |
| **Total** |  | **32 scripts / 110 beats dirigés** |

Chaque script est original et contient :

- un objectif pédagogique ;
- une scène ;
- un profil audio ;
- des notes de direction sur le jeu, le débit, l'articulation, la respiration, la dynamique et la hauteur ;
- une voix Gemini principale et des alternatives ;
- un transcript français avec balises audio Gemini en anglais ;
- plusieurs beats avec débit cible local, ratio de vitesse, pause, intensité, contour de hauteur et taille visuelle ;
- des axes et pondérations de notation ;
- des contrôles qualité et de sécurité vocale.

## Pourquoi les voix ne sont pas encore étiquetées « homme » ou « femme »

La documentation Gemini décrit les voix par couleur — `warm`, `firm`, `clear`, `breathy`, etc. — mais ne fournit pas un contrat stable de genre vocal. VoiceAct conserve donc un casting principal et plusieurs alternatives. La future phase d'écoute produira, pour chaque script :

1. plusieurs essais de voix ;
2. une validation humaine du français, de l'intention et de la qualité ;
3. une étiquette de présentation choisie pour l'application ;
4. au moins deux références contrastées quand la qualité le permet.

Le profil de l'utilisateur ne doit pas imposer qu'une personne copie la hauteur absolue d'une voix associée au même sexe. La notation compare les contours, les écarts relatifs, le rythme et la direction de jeu.

## Construction de la référence véritable

Les `targetWpm`, `relativeRate` et `pauseAfterMs` du corpus sont une **direction de génération**, pas une chronologie déclarée vraie.

Après génération, chaque candidat suit ce pipeline :

1. génération WAV mono 24 kHz ;
2. contrôle automatique : fichier lisible, durée, silence, clipping et artefacts grossiers ;
3. transcription `faster-whisper small` ;
4. alignement forcé des mots/phonèmes ;
5. extraction acoustique : intensité, F0, pauses, énergie et respirations candidates ;
6. comparaison de l'audio obtenu avec l'intention prévue ;
7. écoute humaine et rejet des prises artificielles ;
8. gel du WAV retenu, de son hash et de ses timestamps réels ;
9. création des repères du prompteur à partir de cet alignement ;
10. publication seulement après validation pédagogique.

Ainsi, le prompteur reproduit la performance effectivement entendue, avec ses accélérations et ses silences réels. Il ne déplace jamais les mots à vitesse constante à partir d'une moyenne en mots par minute.

## Règles de notation

- Le timbre et la hauteur absolue du comédien synthétique ne sont pas des cibles.
- La diction et le texte exact sont vérifiés avant l'expressivité.
- Le rythme est local : chaque beat, mot moteur, accélération et pause est évalué séparément.
- La hauteur est normalisée dans le registre propre de l'utilisateur.
- L'intensité est relative au niveau de base de sa prise.
- Une référence TTS défectueuse est rejetée ; l'utilisateur n'est jamais pénalisé pour imiter un artefact.
- Une note ne peut valider un exercice que si transcription, alignement et acoustique sont tous disponibles.

## Commande de validation

```powershell
npm.cmd run test:corpus
```

Cette commande vérifie notamment les huit spécialités, les niveaux 1 à 4, les pondérations, les balises, les limites de vitesse, de taille et de pause, ainsi que la structure complète des prompts Gemini.

## Étape suivante

Avant de multiplier les scripts, VoiceAct doit définir ses formats d'entraînement. Le prompteur restera un checkpoint. Les jeux intermédiaires isoleront une compétence : articulation, vitesse, silence, accent, intonation, écoute, sous-texte, synchronisation et continuité de personnage. Une fois les formats retenus, chaque script du corpus sera relié à un jeu préparatoire et à un boss de validation.
