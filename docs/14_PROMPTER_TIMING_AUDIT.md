# Audit du prompteur temporel — juillet 2026

## Verdict honnête

L'ancien prompteur ne traduisait pas suffisamment le style vocal dans son mouvement. La bande avançait toujours à **105 px/s**. Les durées des phrases variaient, mais une menace retenue et une publicité vive conservaient presque la même sensation de défilement.

La base contient des études, des profils de genres, une analyse de 180 frames de la vidéo fournie et un protocole de corpus. Elle ne contient toutefois pas encore une collection de vidéos professionnelles transcrites et licenciées avec timestamps. Les scènes et créateurs catalogués sont des références à étudier, pas des mesures déjà intégrées. Le produit ne doit pas présenter des estimations comme des performances professionnelles observées.

Le seul enregistrement actuellement aligné de bout en bout est le fichier de vérification Small/MFA : 26 mots, de 0 à environ 10 secondes, 25 mots MFA et 89 phonèmes. Il valide la chaîne technique, pas une norme de jeu professionnelle.

## Modèle temporel appliqué

Ordre de priorité :

1. durée d'une référence professionnelle validée, lorsqu'elle existe ;
2. profil de discipline et d'intention issu de la base de connaissances ;
3. estimation syllabique française ;
4. WPM uniquement comme valeur compréhensible dans l'interface.

Sans référence audio :

```text
durée parlée = syllabes estimées / débit syllabique local
              + ralentissements de ponctuation
              + tenue des mots accentués

largeur affichée = durée réelle × vitesse visuelle
```

Les pauses disposent de leur propre zone. Elles ne sont plus cachées dans la largeur du bloc de texte.

## Cadences visuelles obtenues

| Exercice | Cible UI | Mouvement de la bande | Sensation recherchée |
|---|---:|---:|---|
| Menace contrôlée | 90 MPM | ~74 px/s | contrôle, poids, anticipation |
| Tristesse contenue | 90 MPM | ~74 px/s | fragilité et retenue |
| Horreur froide | 95 MPM | ~76 px/s | attente et révélation |
| Documentaire | 125 MPM | ~92 px/s | stabilité crédible |
| Diagnostic naturel | 130 MPM | ~92 px/s | naturel lisible |
| Actualité dynamique | 155 MPM | ~103 px/s | relance nette |
| Publicité énergique | 175 MPM | ~118 px/s | densité et élan |

La différence horreur/publicité dépasse désormais 50 % visuellement, tout en gardant une géométrie temporelle exacte.

## Décisions d'interface

- ligne rouge fixe à 9 % de la bande ;
- prélecture de trois secondes avant la première intention ;
- texte organisé par phrase, jamais mot par mot ;
- taille = énergie ;
- léger déplacement vertical et mini-courbe = intonation ;
- zone hachurée = silence ;
- animation de la ligne rouge = moment de jeu ;
- consigne active réduite à une seule action ;
- prise en charge de `prefers-reduced-motion`.

## Ce qui reste à faire pour une validation professionnelle

1. obtenir des extraits autorisés ou créer le corpus VoiceAct original ;
2. aligner mots et phonèmes avec Small + MFA ;
3. extraire F0, énergie, débit d'articulation et silences ;
4. regrouper les mots par intentions de phrase ;
5. faire valider les partitions par un directeur artistique ;
6. renseigner `referenceSpeechDurationMs` dans les exercices ;
7. comparer les scores automatiques aux jugements de professionnels.

Le moteur est désormais prêt à donner automatiquement priorité à ces durées mesurées dès qu'elles sont disponibles.
