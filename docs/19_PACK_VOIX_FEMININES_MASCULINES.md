# Pack de voix féminines et masculines

## État réel au 17 juillet 2026

Le pack local contient **29 références** :

- 12 extraits masculins français MLS ;
- 16 extraits féminins français MLS ;
- 1 extrait féminin SIWIS enregistré par une voix professionnelle.

Le poids utile est de **2,14 Mio**, pour une limite technique fixée à **5 Gio**. Le faible poids est volontaire : le dépôt ne doit pas être rempli avec des milliers d'enregistrements sans fonction pédagogique.

Le manifeste complet, les textes, empreintes SHA-256, licences, attributions et chemins sont dans `docs/knowledge/sources/VOICE_REFERENCE_MANIFEST.json`. Le script reproductible est `scripts/download_voice_reference_pack.py`.

## Ce que VoiceAct peut utiliser maintenant

| Usage | Féminin | Masculin | Niveau de preuve |
|---|---:|---:|---|
| articulation française | oui | oui | narration ouverte auditée |
| rythme de lecture | oui | oui | narration ouverte auditée |
| narration / storytelling | oui | oui | narration ouverte auditée |
| accentuation professionnelle | oui | non | SIWIS, voix professionnelle |
| intonation professionnelle | oui | non | SIWIS, voix professionnelle |

Les lecteurs MLS proviennent d'enregistrements LibriVox et ne sont **pas présentés comme des comédiens professionnels**. Ils sont utiles pour les exercices de diction, de rythme et de narration après contrôle acoustique.

## Ce qu'il reste à produire sous contrat

Il n'existe pas de banque française gratuite, commerciale, équilibrée femme/homme et correctement annotée qui couvre à elle seule : doublage film, animation, jeu vidéo, publicité, UGC, actualité, horreur, shorts et plusieurs intensités émotionnelles.

Pour ces rubriques, la bonne solution produit est d'enregistrer deux comédiens francophones professionnels avec une cession de droits adaptée au SaaS. Chaque script devra être livré avec :

- version féminine et masculine ;
- WAV propre 48 kHz / 24 bits ;
- texte exact ;
- direction de jeu, émotion et intensité ;
- prises lente, cible et rapide quand l'exercice travaille le débit ;
- autorisation explicite de diffusion dans VoiceAct, d'analyse acoustique et d'utilisation comme référence pédagogique ;
- interdiction d'entraîner un clone vocal, sauf accord contractuel séparé.

## Règle de personnalisation

Le questionnaire sépare désormais deux informations :

1. le sexe déclaré, utilisé seulement pour initialiser des plages acoustiques plausibles ;
2. la préférence de voix d'exemple : féminine, masculine ou alternée.

Cette séparation évite une erreur pédagogique : une femme peut vouloir travailler avec une référence masculine, un homme avec une référence féminine, et une personne peut préférer ne pas déclarer son sexe. Dans ce dernier cas, VoiceAct doit calibrer progressivement les plages sur son diagnostic personnel.

## Sources et licences

- SIWIS : CC BY 4.0, 9 750 phrases et plus de dix heures enregistrées par une voix française professionnelle. Source officielle : https://datashare.ed.ac.uk/items/1de74991-eede-4b48-8fbe-6c2abaed88d8
- Multilingual LibriSpeech : CC BY 4.0, français équilibré en lecteurs masculins et féminins dans le jeu de test. Source officielle : https://www.openslr.org/94/
- CaFE et RAVDESS ne sont pas embarqués : leurs licences non commerciales ne conviennent pas à un SaaS commercial.

