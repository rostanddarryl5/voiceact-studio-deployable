# Analyse video reference - enregistrement guide type doublage

Source analysee : `C:\Users\Rostand JK\Downloads\1000848903.mp4`

Extraction realisee : 180 frames sur 46,53 secondes, video verticale 576 x 1024.

Artefacts generes :

- `output/video-analysis-1000848903/contact-sheet-01.png`
- `output/video-analysis-1000848903/contact-sheet-02.png`
- `output/video-analysis-1000848903/contact-sheet-03.png`
- `output/video-analysis-1000848903/contact-sheet-04.png`
- `output/video-analysis-1000848903/contact-sheet-05.png`
- `output/video-analysis-1000848903/contact-sheet-06.png`
- `output/video-analysis-1000848903/frame-metrics.json`

## Ce que la video montre concretement

La reference n'est pas un simple bouton d'enregistrement. C'est un dispositif de jeu vocal guide.

Structure observee :

1. Une scene source occupe la partie haute.
2. Une bande blanche de texte/timeline se trouve entre la scene source et la performance.
3. Un curseur rouge vertical avance dans cette bande pour indiquer le moment exact ou lire/jouer.
4. L'utilisateur/doubleur occupe la partie basse, face camera/micro.
5. L'exercice commence par une accroche claire : "A toi de doubler..."
6. Le texte apparait comme un script synchronise, phrase par phrase.
7. L'apprenant ne lit pas seulement des mots : il reproduit une intention, une emotion, une energie, parfois avec gestes et expressions faciales.

## Traduction pour VoiceAct

Pour VoiceAct, l'exercice d'enregistrement doit devenir un "studio de lecture guidee".

Elements indispensables :

- Un prompteur synchronise pendant REC.
- Une timeline visible avec un curseur de lecture.
- Une phrase active mise en avant.
- Les phrases suivantes visibles mais secondaires.
- Les pauses marquees dans la timeline.
- L'intention vocale avant de lire : emotion, ton, niveau d'energie.
- Une taille de texte qui represente l'intensite vocale attendue.
- Une courbe d'intonation pour anticiper la hauteur de voix.
- Une zone de retour live : temps, niveau micro, progression.

## Difference avec l'interface actuelle

L'interface actuelle commence a aller dans la bonne direction avec la timeline et la phrase active, mais elle reste encore trop "fiche d'exercice".

Prochaine evolution recommandee :

1. Transformer la timeline en vraie bande horizontale type sous-titrage.
2. Garder une ligne rouge fixe a gauche de la bande, comme point de declenchement.
3. Faire defiler le script automatiquement de droite vers gauche.
4. Travailler par phrase et intention de phrase, pas en karaoke mot par mot.
5. Garder les explications minimales : l'utilisateur doit sentir quoi faire sans lire un manuel.
6. Pour les exercices de doublage cinema, prevoir une zone "scene reference" au-dessus.
7. Pour les createurs video, remplacer la scene source par une carte de contexte : hook, corps, conclusion, emotion et intention.

## Regle produit a retenir

VoiceAct doit accompagner l'utilisateur dans l'action.

La bonne sensation :

> "Je vois la phrase arriver, je sais comment la jouer, je parle au bon moment, puis le logiciel me note."

La mauvaise sensation :

> "Je lis une longue consigne puis j'appuie sur un bouton record sans savoir exactement comment jouer."

## Regles permanentes pour le prompteur vocal

Ces regles doivent etre appliquees dans toutes les futures evolutions du studio :

1. La barre rouge reste fixe a gauche de la timeline pour laisser le temps de lire ce qui arrive.
2. Le texte defile horizontalement de droite vers gauche.
3. La phrase qui arrive sous la barre rouge est l'intention a jouer.
4. La vitesse de defilement depend du style de lecture : lent pour peur, gravite, tristesse ; plus rapide pour urgence, publicite, colere.
5. Les silences doivent avoir une vraie place visuelle dans le rail, proportionnelle a leur duree en millisecondes.
6. La taille du texte encode l'energie vocale attendue :
   - petit texte : voix basse, calme, retenue ;
   - texte moyen : voix normale, narrative, controlee ;
   - grand texte : intensite, cri, colere, urgence ou forte projection.
7. La courbe d'intonation indique la hauteur ou le mouvement vocal attendu.
8. La notation doit tenir compte du respect de ces consignes : rythme, pauses, energie, variation et intention.
9. L'interface doit guider sans surcharger : l'utilisateur doit comprendre quoi faire en regardant le prompteur, pas en lisant un manuel.
