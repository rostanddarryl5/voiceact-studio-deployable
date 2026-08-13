# VoiceAct — formats d'exercices ludiques

Version : 1.0 — 24 juillet 2026

## Principe de séance

Le prompteur n'est pas le cours. Il est le checkpoint qui vérifie si une compétence apprise dans un jeu peut être réutilisée dans une vraie performance.

Une séance courte suit cette boucle :

1. défi de 15 à 45 secondes ;
2. retour unique et immédiatement compréhensible ;
3. seconde tentative avec une aide ciblée ;
4. mini-récompense ;
5. transfert dans une phrase du corpus ;
6. checkpoint au prompteur seulement quand la compétence est prête.

L'application ne montre jamais douze métriques simultanément. Elle choisit le problème prioritaire et l'illustre.

## 1. Le réalisateur a dit

- **Jeu** : une mascotte-réalisateur donne une seule consigne : « accélère la partie violette », « garde le secret », « pose le dernier mot ».
- **Compétence** : lecture de direction, inhibition et rupture d'intention.
- **Drôle** : la mascotte joue les mauvais exemples de façon volontairement excessive.
- **Mesure** : latence du changement, débit local, pause et contraste d'intensité.
- **Progression** : une consigne, deux consignes, puis une fausse consigne à ignorer.
- **Corpus** : utilise un seul beat, puis deux beats adjacents.

## 2. La boîte de vitesses

- **Jeu** : un véhicule traverse des zones posées, conversationnelles et rapides ; la voix le garde dans la bonne voie.
- **Compétence** : changer de débit sans avaler les phonèmes.
- **Retour** : si la voix accélère trop, le véhicule dérape ; si la diction tombe, les roues se détachent comiquement.
- **Mesure** : MPM local, durées syllabiques, exactitude phonémique et retard cumulé.
- **Progression** : deux vitesses, trois vitesses, accélérations très courtes, rattrapage après silence.
- **Corpus** : les `targetWpm` et `relativeRate` pilotent les zones.

## 3. L'architecte des silences

- **Jeu** : chaque pause construit une partie d'un pont ; une pause trop courte laisse un trou, une pause trop longue crée un embouteillage.
- **Compétence** : silence grammatical, silence émotionnel et respiration de sens.
- **Mesure** : début, fin et durée de chaque silence, présence d'un son de remplissage.
- **Progression** : pause visible, pause annoncée uniquement par l'intention, puis choix de la meilleure pause parmi plusieurs.
- **Corpus** : les pauses extraites de l'audio de référence deviennent les cibles.

## 4. Le détective du mot moteur

- **Jeu** : écouter une référence et trouver le mot qui change le sens ; le rejouer ensuite pour révéler un indice.
- **Compétence** : accent contrastif.
- **Drôle** : de fausses accentuations transforment volontairement le sens de la phrase.
- **Mesure** : pic relatif de durée, d'intensité et de hauteur sur le mot cible.
- **Progression** : mot indiqué, mot à détecter, mot à choisir selon un sous-texte.
- **Corpus** : les mots moteurs sont annotés après audit de la référence.

## 5. La copie fantôme

- **Jeu** : la performance professionnelle est une silhouette lumineuse ; la courbe de l'utilisateur tente de rester dans son sillage.
- **Compétence** : shadowing de rythme, pauses, contour et dynamique sans imitation du timbre.
- **Mesure** : décalage mot/phonème, corrélation de contour normalisé, enveloppe d'énergie relative.
- **Progression** : référence audible, référence partiellement masquée, direction seule.
- **Corpus** : exploite les WAV Gemini validés et leur alignement réel.

## 6. Répare la mauvaise prise

- **Jeu** : la mascotte lit exprès une prise plate, trop pressée ou mal accentuée. L'utilisateur doit identifier l'erreur puis la corriger.
- **Compétence** : écoute critique et auto-direction.
- **Drôle** : les erreurs sont incarnées par des personnages — le Robot Plat, Capitaine Trop-Vite, Monsieur Sans-Fin.
- **Mesure** : choix de diagnostic, puis amélioration objective sur la nouvelle prise.
- **Progression** : erreur évidente, deux erreurs, défaut subtil.
- **Corpus** : les mauvaises variantes sont générées séparément et clairement étiquetées ; elles ne servent jamais de cible positive.

## 7. La roulette du sous-texte

- **Jeu** : une carte secrète modifie le but de la phrase : rassurer pour cacher, séduire pour obtenir, plaisanter pour éviter, menacer sans le montrer.
- **Compétence** : intention et contraste intra-utilisateur.
- **Mesure** : différences de débit, pauses, dynamique et contour entre la prise neutre et la prise dirigée.
- **Progression** : émotions simples, objectifs de jeu, mélange de deux intentions.
- **Corpus** : les scripts film et jeu vidéo offrent des phrases réutilisables avec plusieurs vérités.

## 8. Le combo consonnes

- **Jeu** : une suite de phonèmes propres remplit une jauge ; la précision conserve le combo, la vitesse seule ne rapporte rien.
- **Compétence** : occlusives, consonnes finales, oppositions sourde/sonore et articulation sous débit.
- **Mesure** : omissions, substitutions, voisement et dégradation entre les paliers.
- **Progression** : syllabe, mot, groupe, phrase, intention imposée.
- **Sécurité** : sur-articulation sans stylo ou objet dans la bouche.
- **Corpus** : prépare les passages rapides des scripts Short, News et Animation.

## 9. Le virage d'intention

- **Jeu** : une route change soudain de décor ; la voix doit passer de rassurer à inquiéter ou de plaisanter à révéler au marqueur exact.
- **Compétence** : changement émotionnel précis en milieu de phrase.
- **Mesure** : latence de rupture et contraste acoustique avant/après.
- **Progression** : marqueur visible, événement sonore, changement à déduire du texte.
- **Corpus** : s'appuie sur les beats contrastés des niveaux 2 à 4.

## 10. Réplique-réponse

- **Jeu** : un partenaire joue une ligne ; l'utilisateur doit répondre au bon moment avec une intention compatible.
- **Compétence** : écoute, temps de réaction et vérité de dialogue.
- **Mesure** : latence, texte, direction et continuité rythmique entre les deux tours.
- **Progression** : réponse imposée, trois choix, réponse libre courte.
- **Corpus** : les scènes Film et Animation contiennent le contexte de la réplique hors champ.

## 11. Le vestiaire des personnages

- **Jeu** : l'utilisateur construit trois ancrages confortables — centre de hauteur, énergie et rythme — puis doit retrouver le même personnage après une interruption.
- **Compétence** : continuité en animation et jeu vidéo.
- **Drôle** : les costumes visuels changent, mais la voix doit refuser les « faux accessoires » qui cassent le personnage.
- **Mesure** : médiane F0 relative, plage dynamique, débit, articulation et distance entre prises.
- **Progression** : deux lignes proches, émotions opposées, dix lignes non consécutives.
- **Sécurité** : aucun registre extrême prolongé.

## 12. Le plateau qui bouge

- **Jeu** : l'utilisateur double une scène dont les événements déclenchent les fenêtres de parole : porte, regard, chute, apparition, geste.
- **Compétence** : entrée, sortie et synchronisation d'action.
- **Mesure** : écart aux fenêtres, phonèmes finaux, retard cumulé et récupération.
- **Progression** : phrase fixe, plusieurs fenêtres, événement imprévisible.
- **Corpus** : niveaux 3 et 4 des domaines Film, Animation et Jeu vidéo.

## 13. Le faux direct

- **Jeu** : pendant un bulletin, une carte « mise à jour », « correction » ou « chiffre confirmé » oblige à changer immédiatement de traitement.
- **Compétence** : journalisme dynamique, hiérarchie et correction crédible.
- **Mesure** : exactitude des chiffres, délai de changement, débit et fin descendante.
- **Progression** : mise à jour annoncée, correction en direct, ordre des informations à reconstruire.
- **Corpus** : scripts News niveaux 2 à 4.

## 14. Le montage vivant

- **Jeu** : trois plans apparaissent — hook, corps, conclusion — et la voix doit changer de fonction avec eux.
- **Compétence** : voix off créateur adaptée à la structure réelle de la vidéo.
- **Mesure** : attaque du hook, densité du corps, mot moteur, silence de révélation et fermeture.
- **Progression** : trois phrases, short complet, narration longue avec relances.
- **Corpus** : scripts Short, UGC et Storytelling.

## 15. Le boss de spécialité

- **Jeu** : une scène complète mobilise plusieurs compétences déjà travaillées. Aucun nouvel apprentissage n'est introduit pendant le boss.
- **Compétence** : transfert professionnel.
- **Mesure** : pondération propre à la spécialité et fiabilité technique obligatoire.
- **Retour** : un seul point fort, un seul axe prioritaire et un exercice correctif proposé.
- **Progression** : boss de monde, boss de chapitre, reprise du diagnostic mensuel.
- **Corpus** : tous les scripts de niveau 4.

## Les six formats du MVP

Pour rester solide en trente jours, le premier produit ne doit pas tenter de construire les quinze formats en même temps.

1. **Boîte de vitesses** — débit local et articulation.
2. **Architecte des silences** — pauses et respiration de sens.
3. **Détective du mot moteur** — écoute et accentuation.
4. **Virage d'intention** — prosodie et contraste.
5. **Copie fantôme** — rapprochement progressif de la référence.
6. **Boss au prompteur** — validation et orientation adaptative.

Ces six formats couvrent les métriques déjà visées par le moteur et peuvent réutiliser les mêmes composants : timeline, alignement, courbes, micro, feedback et système de progression.

## Règle d'humour

L'humour sert à rendre l'erreur mémorable, jamais à ridiculiser la voix de l'utilisateur. La mascotte peut se tromper, surjouer et perdre un accessoire ; elle ne se moque jamais d'un accent, d'un timbre, d'une hésitation ou d'une difficulté de diction.

## Prochaine décision produit

Le prochain atelier doit détailler les six formats MVP écran par écran :

- action de l'utilisateur ;
- animation et motion design ;
- durée d'une manche ;
- signal sonore/visuel ;
- métrique fiable ;
- condition de réussite ;
- feedback en une phrase ;
- règle de répétition ou de déblocage ;
- adaptation mobile et desktop ;
- liaison exacte avec les 32 scripts.
