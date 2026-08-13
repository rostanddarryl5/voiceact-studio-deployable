# Corpus temporel professionnel VoiceAct

## État honnête au 16 juillet 2026

VoiceAct ne possède pas encore « un maximum de vidéos professionnelles transcrites ». Le premier extrait réellement ingéré est le trailer officiel de **Sintel**, film ouvert de la Blender Foundation. Les autres corpus du catalogue restent des candidats tant que leurs médias, licences et annotations n'ont pas été validés et importés.

## Source ingérée : Sintel, trailer officiel

- Source : `https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4`
- Page officielle : `https://durian.blender.org/download/`
- Licence annoncée par la production : Creative Commons Attribution 3.0
- Attribution : © Blender Foundation | durian.blender.org
- Langue de la voix : anglais
- Transcription locale : Faster-Whisper Small
- Mesures acoustiques : Parselmouth/Praat
- Usage VoiceAct : étude de rythme cinématographique et test du moteur ; pas référence phonétique française

### Mesure réellement observée

| Groupe d'intention | Début | Fin | Durée parlée | Pause suivante |
|---|---:|---:|---:|---:|
| “What brings you to the land of the gatekeepers?” | 11,92 s | 14,20 s | 2,28 s | 4,17 s |
| “I'm searching for someone.” | 18,37 s | 19,71 s | 1,34 s | — |

Le résultat est incompatible avec une translation uniforme : la première intention est dense, certains mots ne durent que 120 à 200 ms, puis le silence dramatique dure 4 170 ms. Le prompteur doit donc suivre les timestamps de mots et les pauses, pas seulement une moyenne en MPM.

Les fichiers sources sont conservés sur `E:\VoiceAct-Corpus\open-movies\sintel-trailer\`. La transcription et son profil dérivé sont dans `output/transcribe/sintel-trailer/`.

## Politique d'admission dans le produit

1. **Vert — production** : contenus VoiceAct, contenus partenaires autorisés, domaine public, ou licences compatibles avec l'usage commercial après vérification.
2. **Orange — recherche** : corpus non commerciaux ou sous convention. Ils servent à évaluer une méthode, pas à alimenter automatiquement le SaaS commercial.
3. **Rouge — non ingéré** : films commerciaux, scripts et vidéos ordinaires de plateformes sans permission explicite. On peut étudier la littérature scientifique qui les décrit, mais pas aspirer et republier les œuvres.

## Pipeline reproductible

1. enregistrer l'URL, l'auteur, la licence et l'attribution ;
2. transcrire localement avec Small et timestamps de mots ;
3. extraire F0, intensité, voisement et silences avec Parselmouth ;
4. exécuter `npm run corpus:profile -- <transcription.json> <profile.json>` ;
5. regrouper les mots par intentions, puis faire annoter ton, émotion, respiration et accentuation ;
6. faire valider l'exercice par un directeur artistique avant publication ;
7. injecter les ancres validées dans `referenceWordTimings`.

## Priorité de constitution

- films ouverts Blender et autres œuvres CC BY vérifiées ;
- corpus français expressifs autorisés à l'usage commercial ;
- corpus original VoiceAct enregistré avec comédiens et créateurs français ;
- partenariats avec studios, directeurs artistiques et créateurs voix off.

Le corpus original VoiceAct doit devenir la référence principale : il donnera les bonnes intentions en français, des droits clairs, des prises multiples et des validations pédagogiques impossibles à garantir par collecte automatique du web.
