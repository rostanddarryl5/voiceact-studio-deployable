# Metronome expressif et courbe d'intonation

## Vision

VoiceAct doit guider l'apprenant avant et pendant la lecture.

Le metronome expressif indique :
- ou respirer ;
- combien de temps suspendre ;
- quel mot accentuer ;
- quand ralentir ;
- quand repartir.

La courbe d'intonation indique :
- la direction de la voix ;
- la tension emotionnelle ;
- la montee ou descente attendue ;
- la zone ou la voix doit rester stable ;
- la chute finale.

## Pourquoi ce n'est pas un metronome musical classique

Un metronome musical impose un tempo regulier.

Une voix off expressive n'est pas toujours reguliere. Elle utilise :
- accelerations ;
- ralentissements ;
- silences ;
- ruptures ;
- respirations ;
- suspensions.

Le metronome VoiceAct doit donc etre contextuel.

## Format de guidage par segment

Chaque texte est transforme en segments.

Exemple de structure :

```json
{
  "text": "Personne n aurait du entrer dans cette maison apres minuit.",
  "pauseAfterMs": 700,
  "pace": "slow",
  "energy": "low",
  "intonation": "low_rise",
  "emphasis": ["Personne", "apres minuit"],
  "coachingNote": "Installe le mystere sans reveler trop vite."
}
```

## Types de pauses

### Pause courte : 250-400 ms

Usage :
- respiration legere ;
- separation de deux idees simples ;
- rythme naturel.

### Pause moyenne : 500-800 ms

Usage :
- suspense ;
- preparation d'une revelation ;
- changement d'image mentale.

### Pause longue : 900-1400 ms

Usage :
- horreur ;
- chute dramatique ;
- phrase finale ;
- moment de tension.

Attention : sur mobile, la pause longue doit etre visualisee clairement, sinon l'utilisateur pense que l'app a bloque.

## Formes d'intonation pedagogiques

### low_flat

Voix basse, stable.

Usage :
- menace calme ;
- horreur ;
- confidence ;
- tension froide.

### low_rise

Voix basse avec legere montee.

Usage :
- question mysterieuse ;
- annonce d'une revelation ;
- debut de hook horreur.

### rise

Montee claire.

Usage :
- surprise ;
- curiosite ;
- enjeu qui augmente.

### fall

Descente nette.

Usage :
- conclusion ;
- certitude ;
- gravite ;
- phrase documentaire.

### rise_fall

Montee puis chute.

Usage :
- punchline ;
- revelation ;
- conclusion dramatique.

### build

Montee progressive d'energie.

Usage :
- motivation ;
- storytelling ;
- climax.

## Affichage mobile

La courbe doit etre lisible sur petit ecran.

Recommandation :
- afficher une ligne simple au-dessus du texte ;
- utiliser des points par segment ;
- colorer l'energie ;
- afficher les pauses comme des espaces visuels ;
- rendre le mot d'impact plus marque.

Pas de waveform complexe au depart.

La waveform montre ce que l'utilisateur a fait.

La courbe d'intonation montre ce qu'il doit viser.

Les deux doivent etre differenciees.

## Exercice type

Texte :
"Personne n aurait du entrer dans cette maison apres minuit. Pourtant, la camera a continue d enregistrer."

Guidage :
- segment 1 : voix basse, lente, pause moyenne ;
- segment 2 : tension plus forte, pause courte avant "camera" ;
- fin : chute froide.

Feedback attendu :
"Tu as respecte le debit, mais la pause avant la revelation est trop courte. Reprends en laissant un silence plus net avant 'la camera'."

