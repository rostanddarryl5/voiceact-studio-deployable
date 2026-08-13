# Moteur acoustique VoiceAct — étape Praat

## Rôle dans la chaîne

1. Le navigateur enregistre le même fichier audio que celui envoyé à la transcription.
2. `faster-whisper small` produit le texte et les timestamps des mots.
3. Praat-Parselmouth décode ce même fichier en mono 16 kHz et mesure la prosodie toutes les 10 ms.
4. Le client remplace son estimation de hauteur par la courbe Praat, puis calcule les écarts par phrase et intention.
5. Une prise ne peut valider un exercice que si la transcription est au moins `small` et si la qualité acoustique Praat est `high`.

## Mesures exposées

- F0 médiane et courbe F0 ;
- étendue P10–P90 en demi-tons, plus robuste que min–max ;
- proportion de trames voisées ;
- dynamique d'intensité P10–P90, calculée uniquement dans les zones voisées ;
- HNR moyen, indicateur acoustique de périodicité/harmonicité ;
- 1 point de hauteur et d'intensité toutes les 10 ms pour l'analyse segment par segment.

Ces mesures sont observables. Elles ne permettent pas, seules, d'affirmer qu'une personne « ressent » une émotion. VoiceAct doit les comparer aux consignes de jeu, au texte attendu et, à terme, à des références professionnelles annotées.

## Contrôles réalisés le 16 juillet 2026

- test synthétique à 180 Hz : fréquence récupérée à ±3 Hz ;
- six tests Python réussis ;
- huit tests du moteur de score TypeScript réussis ;
- fichier français réel de 10,95 s : 1 095 trames, qualité `high`, F0 médiane 206,8 Hz, étendue 5,36 demi-tons, dynamique 11,65 dB et HNR 11,44 dB ;
- réponse identique vérifiée via le service Python puis via l'API web VoiceAct.

## Limites et prochaine étape

Le HNR et la F0 ne doivent pas encore recevoir des seuils pédagogiques universels : ils varient selon la voix, le microphone et la pièce. Il faut ensuite ajouter l'alignement phonémique avec le texte connu, puis calibrer les scores sur des prises françaises notées par des professionnels.

Parselmouth donne accès aux algorithmes internes de Praat. Références :

- https://parselmouth.readthedocs.io/en/stable/api_reference.html
- https://github.com/YannickJadoul/Parselmouth

Parselmouth est distribué sous GPL v3 ou ultérieure. Le mode de déploiement et de distribution devra faire l'objet d'une revue de licence avant commercialisation.
