# Moteur d’analyse VoiceAct — version 2.0

## Principe

VoiceAct ne prétend pas détecter l’émotion intérieure d’un apprenant. Il mesure la correspondance entre une performance et une direction vocale observable : texte, rythme, pauses, intensité relative et contour d’intonation.

## Pipeline exécuté

1. Le navigateur décode l’audio et le convertit en signal mono.
2. Des fenêtres de 40 ms espacées de 10 ms mesurent énergie RMS et dBFS.
3. Le seuil parole/silence s’adapte au bruit de fond de la prise.
4. Les intervalles de parole, pauses, saturation et rapport parole/silence sont extraits.
5. La hauteur fondamentale est estimée entre 65 et 500 Hz par autocorrélation normalisée.
6. Le serveur demande au service VoiceAct une transcription française avec timestamps des mots.
7. `faster-whisper` produit la transcription indépendante; WhisperX affine l’alignement lorsqu’il est disponible.
8. Un alignement par programmation dynamique compare chaque mot reconnu au texte de la leçon.
9. Les timestamps alignés découpent l’acoustique par phrase et intention.
10. Chaque phrase est évaluée par rapport à sa propre consigne : débit, silence, énergie et courbe mélodique.
11. Le score global combine clarté 30 %, rythme 25 %, intonation 18 %, expressivité 17 % et qualité technique 10 %.

Le texte attendu n’est pas injecté comme transcription imposée : le moteur ne peut donc pas créditer artificiellement des mots simplement parce qu’ils figuraient dans l’exercice.

## Règles de confiance

- Une analyse sans transcription est marquée `local-only`, ne donne aucun XP et ne débloque aucune étape.
- Une analyse complète doit dépasser 68 % de confiance, 55 % d’exactitude verbale et 45/100 en qualité technique pour devenir validante.
- La hauteur est comparée relativement à la voix de l’utilisateur. Une voix grave n’est donc pas pénalisée face à une voix aiguë.
- Les conseils sont générés depuis la mesure la plus faible, puis depuis la phrase prioritaire à reprendre.
- Un repli de WhisperX vers les timestamps faster-whisper est visible dans le champ `alignment`; il n’est jamais masqué.

## Configuration

Le fournisseur par défaut est le service auto-hébergé `voiceact-local`. Copier `.env.example` vers `.env.local` et utiliser le même secret pour `VOICEACT_SPEECH_SERVICE_TOKEN` et `VOICEACT_INTERNAL_TOKEN`.

OpenAI reste un secours optionnel. Il n’est appelé que si `VOICEACT_ALLOW_OPENAI_FALLBACK=true` et si `OPENAI_API_KEY` est définie. Voir [10_SELF_HOSTED_TRANSCRIPTION.md](10_SELF_HOSTED_TRANSCRIPTION.md) pour le lancement et l’hébergement.

## Limites connues

- La qualité d’alignement dépend du bruit, du microphone, de l’accent et du type de phonation.
- La robustesse des scores doit être calibrée sur un corpus de voix françaises annoté par des professionnels.
- La hauteur fondamentale devient moins fiable sur une voix très soufflée, criée, bruitée ou polyphonique.
- Le scoring doit être testé pour l’équité entre accents, âges, genres vocaux et microphones mobiles.
- Les scores pédagogiques ne constituent pas un diagnostic médical ou orthophonique.

## Étape de validation suivante

Constituer 100 à 200 prises annotées sur les exercices du MVP. Deux professionnels notent indépendamment chaque dimension. Les poids et seuils ne seront ajustés qu’après comparaison avec cet accord humain.
