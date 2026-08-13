# Catalogue de corpus audio et vidéo

Date de vérification : 15 juillet 2026.

## Légende d'usage

- `VERT` : peut raisonnablement entrer dans une piste commerciale, sous réserve de respecter la licence et de vérifier chaque fichier.
- `ORANGE` : recherche, prototype ou négociation ; ne pas intégrer au produit payant sans autorisation.
- `ROUGE` : inspiration/analyse interne uniquement ; ni audio, ni vidéo, ni transcript copié dans VoiceAct.

## Corpus prioritaires

| Corpus | Langue | Contenu / volume | Horodatage | Licence / accès | Statut VoiceAct |
|---|---|---|---|---|---|
| [VoxPopuli](https://github.com/facebookresearch/voxpopuli) | français + 22 | 400k h non annotées, 1,8k h transcrites ; français présent | segments, scripts d'alignement | données CC0 ; vérifier notice Parlement européen | VERT pour calibrage débit/information |
| [Common Voice FR](https://mozilladatacollective.com/datasets/cmn5zugst00w3nv07upovf2bg) | français | voix lues multi-locuteurs | fichier/segment | CC0 indiqué par Mozilla pour le corpus | VERT pour ASR et profils neutres |
| [Multilingual LibriSpeech](https://www.openslr.org/94/) | français + 7 | audiobooks ; paquet français 61 Go FLAC | segments/transcriptions | CC BY 4.0 | VERT, vérifier œuvres/traductions selon territoire |
| [CREMA-D](https://github.com/CheyneyComputerScience/CREMA-D) | anglais | 7 442 clips, 91 acteurs, 6 émotions, intensités et votes | un fichier par réplique | ODbL 1.0 + DbCL 1.0 | VERT potentiel ; attribution/share-alike base à étudier |
| [Blender Open Movies](https://video.blender.org/c/blender_open_movies/videos) | surtout anglais | films et ressources ouvertes ; Sintel, Tears of Steel, etc. | sous-titres à aligner | films annoncés CC BY selon projet | VERT après vérification film par film |
| [LibriVox](https://librivox.org/pages/public-domain/) | multilingue | audiobooks et lectures dramatiques | chapitres ; alignement à produire | domaine public aux États-Unis ; statut territorial variable | ORANGE jusqu'à revue France/UE |
| [RAVDESS](https://zenodo.org/records/1188976) | anglais | 7 356 fichiers, acteurs, 8 émotions, 2 intensités | fichier | CC BY-NC-SA 4.0 ; licence commerciale disponible | ORANGE, contacter les auteurs |
| [IEMOCAP](https://sail.usc.edu/iemocap/) | anglais | ~12 h, dialogues joués/improvisés, transcriptions et émotions | tours/segments | formulaire et conditions USC | ORANGE recherche/négociation |
| [GEMEP](https://www.unige.ch/cisa/gemep) | français/scénarios français | 10 acteurs, 18 états affectifs ; Core Set 145 fichiers | fichier/segment | gratuit pour recherche après accord | ORANGE, contacter UNIGE |
| [CINEMO](https://aclanthology.org/L10-1334/) | français | 2 h 13, 51 locuteurs, 4k segments, émotions complexes, doublage de scènes | segments | accès/licence à confirmer | ORANGE, excellent pour valider la taxonomie |
| [EVE](https://data.europa.eu/data/datasets/doi-10-58119-ulg-vreiob?locale=en) | français/anglais | corpus audiovisuel joué, validation perceptive large | fichier/segment | licence à confirmer sur le dépôt | ORANGE |
| [CMU-MOSEAS](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106386/) | français + 3 | 10 000 phrases de monologues web, émotions et attributs | phrase | EULA ; caractéristiques non inversibles publiques | ORANGE pour analyse francophone naturelle |
| [CMU-MOSEI](https://aclanthology.org/P18-1208/) | anglais | >23,5k segments, >1 000 locuteurs YouTube, 6 émotions | segments | CC BY-NC 4.0 selon distribution | ORANGE recherche |
| [HowTo100M](https://www.di.ens.fr/willow/research/howto100m/) | multilingue dominant anglais | 1,22M vidéos narrées, 136M clips | ASR avec segments temporels | droits des vidéos source non transférés | ROUGE pour le produit ; statistiques internes seulement |
| [YouCook2](https://youcook2.eecs.umich.edu/) | anglais | 2 000 vidéos, 176 h, étapes temporelles | début/fin par étape | vidéos YouTube ; licence produit non garantie | ROUGE/ORANGE recherche |
| [ActivityNet Captions](https://arxiv.org/abs/1705.00754) | anglais | ~20k vidéos, 100k descriptions temporelles | début/fin par événement | licence des vidéos à vérifier | ROUGE/ORANGE recherche |
| [MovieNet](https://movienet.github.io/) | anglais + sous-titres | 1 100 films, scripts/sous-titres et alignements | scène/sous-titre/script | accord dataset ; films exclus | ROUGE, référence d'alignement uniquement |
| [MAD](https://github.com/Soldelli/MAD) | anglais | 384k descriptions, 1 200 h, 650 films | phrase/segment | NDA ; films non distribués pour copyright | ROUGE, méthodologie uniquement |
| [SAM](https://sail.usc.edu/ccmi/project-sam/) | anglais | audio de films aligné aux sous-titres | mot/phonème automatique | recherche ; droits films non transférés | ROUGE, méthodologie d'alignement |

## Ce que chaque famille apporte

### Calibrage linguistique francophone

VoxPopuli, Common Voice et MLS fournissent des distributions de durée, syllabes, pauses et variabilité par locuteur. Ils ne fournissent pas seuls une direction d'acteur fiable.

### Émotions jouées et validées

CREMA-D, RAVDESS, IEMOCAP, GEMEP, CINEMO et EVE permettent de tester quels paramètres séparent réellement les intentions. Un corpus joué ne doit pas être présenté comme une vérité sur les émotions spontanées.

### Voix off web naturelles

CMU-MOSEAS, CMU-MOSEI et HowTo100M fournissent des monologues ou narrations réelles, mais leurs restrictions empêchent souvent l'intégration directe dans un SaaS commercial. Ils servent à apprendre des distributions et à concevoir notre propre collecte.

### Cinéma et synchronisation

MovieNet, MAD et SAM montrent comment aligner scripts, sous-titres, parole et vidéo. Ils ne donnent pas automatiquement le droit de rediffuser les scènes ou les répliques.

## Ordre d'acquisition recommandé

1. Common Voice FR, VoxPopuli et MLS pour construire les outils français.
2. CREMA-D pour prototyper l'émotion jouée avec une licence ouverte à étudier précisément.
3. Blender Open Movies pour créer les premiers vrais exercices de doublage vidéo licenciables.
4. Enregistrer notre propre corpus français avec comédiens et directeurs artistiques.
5. Négocier RAVDESS/GEMEP/EVE si leur valeur dépasse le coût de licence.
6. Utiliser MovieNet/MAD/SAM uniquement pour améliorer la méthode d'alignement.

La version structurée du catalogue se trouve dans `CORPUS_CATALOG.json`.
