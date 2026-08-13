# Alignement phonémique VoiceAct — Montreal Forced Aligner

## Décision

VoiceAct utilise Montreal Forced Aligner (MFA) dans un service séparé. Le modèle `french_mfa` est prévu pour l'alignement forcé de transcriptions françaises et a été entraîné notamment sur Common Voice, GlobalPhone et un corpus de français à accents africains.

Le service principal continue de fonctionner si MFA est indisponible. Dans ce cas, `phonemeAlignmentError` explique la dégradation et aucune fausse note phonémique n'est produite.

## Chaîne de traitement

1. L'interface transmet l'audio et le texte exact de l'exercice.
2. `small` transcrit librement l'audio pour détecter les omissions et substitutions de mots.
3. Praat mesure la prosodie.
4. Le service MFA convertit l'audio en WAV mono 16 kHz.
5. `mfa align_one` utilise le dictionnaire, le G2P et le modèle acoustique français.
6. Le TextGrid est converti en intervalles de mots et de phonèmes horodatés.

## Règle d'honnêteté du score

Un alignement forcé place les phonèmes attendus sur l'audio. Il ne démontre pas, seul, que ces phonèmes ont été correctement articulés. La réponse porte donc explicitement `canScorePronunciation: false`.

Cette première version permet :

- d'afficher où chaque son devait commencer et finir ;
- de relier les phonèmes à leur mot ;
- de préparer la comparaison avec une voix professionnelle ;
- de détecter ultérieurement les durées anormales après calibration.

Elle ne modifie pas encore la note de clarté. La prochaine couche nécessaire est un score de confiance acoustique par phonème de type GOP, calibré sur des voix françaises évaluées par des professionnels.

## Déploiement

Le service est défini dans `mfa-service/` et ajouté à `compose.yaml`. Les modèles acoustique, dictionnaire et G2P français sont intégrés à son image. Seuls les services privés `speech` et `phonemes` communiquent entre eux.

L'installation locale Conda a été tentée le 16 juillet 2026 avec MFA 3.4, puis avec le profil Windows stable recommandé (`2.2.17`, OpenFst `1.8.2`, Kaldi `5.5.1068`). Les deux solveurs sont restés bloqués respectivement vingt et dix minutes avant l'installation du moindre paquet. Les fichiers temporaires ont été supprimés. Le code ne doit donc pas être déclaré validé localement tant que l'image Docker ou un environnement MFA fonctionnel n'a pas produit un vrai TextGrid sur le diagnostic.

Sources officielles :

- https://montreal-forced-aligner.readthedocs.io/en/latest/installation.html
- https://montreal-forced-aligner.readthedocs.io/en/stable/user_guide/workflows/alignment.html
- https://mfa-models.readthedocs.io/en/latest/acoustic/French/French%20MFA%20acoustic%20model%20v3_0_0.html
- https://montreal-forced-aligner.readthedocs.io/en/v3.4.0/user_guide/implementations/alignment_analysis.html
