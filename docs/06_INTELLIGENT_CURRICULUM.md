# VoiceAct — Cursus intelligent, diagnostic et exercices professionnels

Date : 15 juillet 2026

## Décision produit

VoiceAct ne doit pas être une simple bibliothèque d’exercices libres.

Le bon modèle est un cursus intelligent :

1. l’utilisateur s’inscrit ;
2. il répond à quelques questions sur ses objectifs ;
3. il passe un diagnostic vocal initial ;
4. le logiciel évalue ses forces/faiblesses ;
5. VoiceAct lui construit un parcours progressif ;
6. les exercices se débloquent avec des notes de passage ;
7. les données de performance orientent la suite du cursus ;
8. après environ un mois, l’utilisateur relit un texte comparable au diagnostic initial ;
9. le logiciel lui montre son évolution avec des preuves audio, scores et graphiques.

## Argument de vente central

“VoiceAct ne te donne pas juste des exercices. Il t’écoute, évalue ton niveau, identifie tes faiblesses, puis construit ton entraînement vocal comme un coach de doublage.”

## Diagnostic initial

Après inscription, VoiceAct doit demander :

- objectif principal : créateur vidéo, doublage cinéma, publicité, narration documentaire ;
- niveau estimé : débutant, intermédiaire, avancé ;
- langue/accent ;
- objectif de voix : plus crédible, plus émotionnel, plus clair, plus rythmé ;
- fréquence d’entraînement ;
- type de contenu préféré.

Ensuite, le logiciel donne un texte de diagnostic avec :

- ton attendu ;
- émotion par partie ;
- hauteur vocale attendue ;
- pauses indiquées ;
- mots à accentuer ;
- courbe d’intonation.

Ce premier audio devient la référence de départ.

## Réévaluation mensuelle

Après environ 30 jours :

- l’utilisateur relit le même texte ou un texte équivalent ;
- VoiceAct compare les scores ;
- l’utilisateur peut écouter “avant / après” ;
- le logiciel montre la progression :
  - clarté ;
  - rythme ;
  - intonation ;
  - expressivité ;
  - gestion des silences ;
  - stabilité vocale.

## Exercices de reproduction de voix pro

Une rubrique importante doit être “Reproduis la prise”.

Principe :

1. l’utilisateur écoute une voix off professionnelle ou une voix de référence ;
2. il voit le texte découpé en segments ;
3. VoiceAct indique :
   - pauses ;
   - intonation ;
   - énergie ;
   - émotion ;
   - mots accentués ;
4. l’utilisateur enregistre sa version ;
5. le logiciel compare sa prise à la référence ;
6. il reçoit une note et des conseils.

Attention : pour le SaaS commercial, il faudra utiliser des voix de référence que nous avons le droit d’exploiter :

- voix générées/licenciées ;
- comédiens voix partenaires ;
- voix internes ;
- voix libres de droits clairement vérifiées.

## Exercices professionnels adaptés

La base d’exercices doit s’inspirer de pratiques utilisées par :

- coachs vocaux ;
- comédiens de doublage ;
- narrateurs ;
- professeurs de diction ;
- formateurs en prise de parole ;
- professionnels de voix off publicitaire.

Exemples d’exercices à intégrer ou suggérer :

- articulation avec stylo dans la bouche ;
- lecture lente avec exagération des consonnes ;
- lecture chuchotée puis voix pleine ;
- même texte avec trois émotions différentes ;
- pause volontaire après chaque groupe de sens ;
- descente de voix en fin de phrase ;
- lecture avec sourire vocal ;
- lecture documentaire sans dramatisation ;
- menace calme sans haussement de volume ;
- reproduction d’une prise modèle.

Le logiciel peut proposer certains exercices hors micro comme échauffement, puis demander une prise mesurable.

## Déblocage progressif

Chaque exercice doit avoir :

- niveau ;
- objectif ;
- note de passage ;
- prérequis ;
- XP ;
- compétences travaillées ;
- badge potentiel.

Exemple :

- Exercice 1 : diagnostic / hook simple ;
- Exercice 2 : rythme et pauses ;
- Exercice 3 : intonation descendante ;
- Exercice 4 : émotion contrôlée ;
- Exercice 5 : reproduction d’une voix référence ;
- Exercice 6 : performance complète.

Si l’utilisateur échoue :

- l’exercice suivant reste verrouillé ;
- VoiceAct propose une reprise ciblée ;
- le logiciel peut recommander un mini-exercice de correction.

## Cursus adaptatif

VoiceAct doit utiliser les données pour orienter la suite :

- si rythme faible : plus d’exercices de débit et pauses ;
- si clarté faible : articulation, diction, volume ;
- si intonation faible : courbes vocales et imitation ;
- si expressivité faible : émotion, intention, variation ;
- si trop de silence : fluidité ;
- si pas assez de silence : respiration et pauses.

## Implémentation MVP actuelle

La version actuelle commence à poser cette logique :

- note de passage à 70/100 ;
- meilleur score par exercice sauvegardé ;
- exercice suivant verrouillé tant que le précédent n’est pas validé ;
- résultats en dimensions ;
- priorité de reprise.

Prochaines étapes techniques :

1. ajouter un écran diagnostic initial ;
2. créer une vraie table de compétences ;
3. stocker l’historique des prises ;
4. comparer les prises dans le temps ;
5. ajouter des exercices de référence audio ;
6. ajouter une logique de recommandation automatique.

