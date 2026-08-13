# VoiceAct — six jeux MVP, écran par écran

Version : 1.0 — 24 juillet 2026

## Nouvelle architecture

Le « boss au prompteur » n'est plus compté comme un jeu. Il reste le checkpoint de fin de séquence.

Les six jeux MVP deviennent :

1. **La Voltige vocale** — échauffement quotidien avec la mascotte ;
2. **La Boîte de vitesses** — débit variable ;
3. **L'Architecte des silences** — pauses et respiration de sens ;
4. **Le Détective du mot moteur** — accentuation ;
5. **Le Virage d'intention** — changement de jeu ;
6. **La Copie fantôme** — transfert vers la référence professionnelle.

La boucle quotidienne est : check-in → Voltige vocale → jeu adaptatif → checkpoint au prompteur si l'utilisateur est prêt.

---

## 1. La Voltige vocale

### Finalité

Réveiller doucement la voix, explorer une petite plage de hauteur confortable et préparer l'utilisateur à suivre une courbe d'intonation.

Le jeu ne mesure pas la « meilleure hauteur ». Il mesure la capacité à déplacer sa hauteur relative avec continuité, sans forcer.

### Écran 1 — check-in

- Mascotte posée sur une petite piste.
- Question unique : « Comment se sent ta voix aujourd'hui ? »
- Choix : disponible, un peu fatiguée, douloureuse/enrouée.
- Disponible : séance normale.
- Fatiguée : parcours plus court et plus central.
- Douloureuse/enrouée : pas de jeu vocal ; repos conseillé et orientation vers un professionnel si le problème persiste.

### Écran 2 — calibration personnelle

- Consigne : « Fais un mmm confortable, comme quand quelque chose sent bon. »
- Deux sons de 2 secondes, séparés par un repos.
- Le moteur estime la médiane F0 fiable, la stabilité, le bruit et le niveau sonore.
- Aucune valeur en hertz n'est montrée.
- La mascotte se place au milieu du ciel : ce point devient le zéro relatif du jour.

### Écran 3 — répétition guidée

- Trois grands cerceaux seulement : centre, légèrement au-dessus, légèrement en dessous.
- Démonstration visuelle sans score.
- Sons recommandés : `mmm–ou`, `vvv–ou` ou trille doux `brrr`.
- Le texte-guide défile en bas et dessine lui-même la trajectoire :
  - `mmmmmm–OU` monte ;
  - `ouuu–mmm` descend ;
  - un espace respiratoire fait flotter la mascotte sans la faire tomber.

### Écran 4 — mini-jeu

- Défilement horizontal constant du décor.
- Cerceaux placés selon une trajectoire pédagogique, pas aléatoire.
- La hauteur de la mascotte est pilotée par la hauteur relative lissée de la voix.
- Un halo indique la zone de tolérance, large chez le débutant.
- Les cerceaux ne demandent jamais les extrêmes de la plage détectée.
- Une séquence dure 8 à 12 secondes, suivie de 4 à 6 secondes de repos.
- Trois séquences maximum pour un total vocalisé de 30 à 40 secondes.

### Écran 5 — retour

- Un seul message principal :
  - « Courbe fluide » ;
  - « Monte moins haut, mais plus doucement » ;
  - « Ta voix se coupe entre les cerceaux » ;
  - « Trop de bruit pour mesurer correctement ».
- La mascotte rejoue la meilleure trajectoire.
- Pas de classement sur la hauteur maximale.

### Écran 6 — passage à la séance

- « Ta voix est prête. Aujourd'hui, on travaille les silences. »
- Le moteur choisit le jeu suivant selon le cursus et la dernière faiblesse mesurée.

### Moteur temps réel

1. Capture micro avec `getUserMedia`.
2. Analyse hors thread principal avec `AudioWorklet`.
3. Fenêtres de 30 à 50 ms.
4. Détection de hauteur par YIN ou McLeod, puis contrôle de confiance.
5. Conversion relative en demi-tons :

   `écart = 12 × log2(F0 / F0_calibration)`

6. Filtre médian contre les erreurs d'octave, puis lissage visuel de 80 à 140 ms.
7. Hystérésis pour empêcher la mascotte de trembler.
8. En absence de voisement fiable, la mascotte flotte ou revient doucement au centre ; elle ne chute jamais.
9. Le score porte sur la trajectoire, la continuité, le confort déclaré et la précision relative.

### Courbe de difficulté

| Niveau | Trajectoire | Tolérance | Étendue relative |
|---|---|---:|---:|
| 1 | centre, haut, centre, bas | ±1,8 demi-ton | ±2 demi-tons |
| 2 | glissés doux et paliers | ±1,5 demi-ton | ±3 demi-tons |
| 3 | vagues et changements plus courts | ±1,2 demi-ton | ±4 demi-tons |
| 4 | courbe issue d'une intention parlée | ±1 demi-ton | plage confortable apprise |

---

## 2. La Boîte de vitesses

### Écran 1 — mission

- Mascotte dans un petit véhicule.
- « Garde les mots propres quand la route accélère. »
- Écoute d'un bon et d'un mauvais exemple très courts.

### Écran 2 — essai sans texte long

- Trois groupes de quatre mots.
- Route verte : posé.
- Route bleue : conversationnel.
- Route violette : rapide.
- Les mots traversent une ligne de lecture placée à gauche.

### Écran 3 — manche

- Une phrase complète issue du corpus.
- La route change de couleur selon les beats.
- Le véhicule réagit au retard, mais la vitesse du décor reste celle de la référence.
- L'utilisateur ne contrôle pas le véhicule par le volume.

### Écran 4 — retour

- Superposition de sa cadence et de la référence.
- Un seul diagnostic : trop tôt, trop tard ou phonèmes avalés.
- Rejouer uniquement la zone ratée.

### Écran 5 — transfert

- Même compétence dans une nouvelle phrase.
- Réussite : accès au checkpoint.
- Échec : vitesse réduite de 8 à 12 %, jamais texte complètement différent.

---

## 3. L'Architecte des silences

### Écran 1 — intention

- « Ici, le silence ne coupe pas la phrase. Il lui donne un sens. »
- La mascotte montre deux versions d'une réplique : sans pause et avec pause.

### Écran 2 — choix d'écoute

- L'utilisateur choisit quel silence correspond à révéler, réfléchir ou menacer.
- Les durées ne sont pas encore affichées en millisecondes.

### Écran 3 — construction

- Chaque groupe de sens est une plateforme.
- Parler construit la plateforme ; garder le silence déploie le pont.
- Une respiration ou un son de remplissage ne compte pas comme silence propre.

### Écran 4 — retour

- Le pont montre uniquement les pauses trop courtes ou trop longues.
- Une phrase de coaching : « Laisse encore un battement avant la révélation. »

### Écran 5 — transfert

- Le texte et la timeline sont moins aidés.
- La pause est déclenchée par l'intention et non par un gros symbole.

---

## 4. Le Détective du mot moteur

### Écran 1 — énigme

- Écoute d'une prise professionnelle.
- « Quel mot change vraiment le sens ? »

### Écran 2 — choix

- Trois mots candidats apparaissent comme des indices.
- L'utilisateur touche le mot qu'il pense accentué.

### Écran 3 — preuve

- Affichage simple de la durée, de l'énergie et du contour relatifs sur le mot.
- Pas de courbes scientifiques complètes.

### Écran 4 — imitation

- L'utilisateur lit la phrase en portant le même mot.
- La taille visuelle du mot correspond à l'intensité relative.
- La courbe séparée correspond à la hauteur.

### Écran 5 — sous-texte

- Un nouveau mot moteur est imposé sur la même phrase.
- L'utilisateur découvre comment le sens change sans changer le texte.

---

## 5. Le Virage d'intention

### Écran 1 — carte de jeu

- Deux intentions : « rassure » puis « inquiète ».
- Une animation montre le point exact du virage.

### Écran 2 — répétition courte

- Deux fragments séparés.
- Le moteur vérifie que les deux couleurs acoustiques sont distinctes chez cet utilisateur.

### Écran 3 — phrase continue

- Les fragments sont réunis.
- Un événement visuel ou sonore déclenche le changement.

### Écran 4 — résultat

- Affichage avant/après : débit, contour et énergie relatifs.
- Retour : contraste trop faible, changement trop tôt ou rupture réussie.

### Écran 5 — mode surprise

- Le marqueur visuel disparaît.
- Le texte et la scène doivent suffire à provoquer le virage.

---

## 6. La Copie fantôme

### Écran 1 — écoute active

- Référence professionnelle validée.
- Mission unique : repérer le rythme, le silence ou la courbe, jamais tout à la fois.

### Écran 2 — détective

- L'utilisateur place un marqueur là où il entend le changement.
- Cette étape vérifie qu'il a compris avant de lui demander d'imiter.

### Écran 3 — répétition assistée

- Référence découpée en deux ou trois beats.
- Écoute, mémoire, reproduction.

### Écran 4 — fantôme

- La référence devient une courbe translucide.
- La prise de l'utilisateur apparaît en direct.
- Timbre et hauteur absolue ne sont pas comparés.

### Écran 5 — prise autonome

- Audio de référence masqué.
- Prompteur et direction seuls.

### Écran 6 — checkpoint

- Passage au prompteur complet.
- Résultat : un point fort, une priorité, une reprise ciblée ou la suite du cursus.

---

## Faisabilité de la Voltige vocale

### Prototype

Le cœur du jeu est réalisable en 3 à 5 jours :

- permission micro ;
- détection de hauteur ;
- déplacement vertical ;
- cerceaux ;
- une piste de sons-guides ;
- score simple.

### MVP fiable

Prévoir 7 à 12 jours pour :

- calibration personnelle ;
- filtrage du bruit et des erreurs d'octave ;
- fonctionnement mobile ;
- animation fluide ;
- états permission refusée/micro absent ;
- réglage de la latence ;
- mode fatigue ;
- sécurité et tests sur plusieurs voix et appareils.

Le jeu est donc techniquement accessible dans le délai du MVP, à condition d'en faire une priorité et de ne pas chercher immédiatement plusieurs mondes, skins ou classements.

## Règles de sécurité

- Le jeu commence après un check-in, jamais automatiquement en cas de douleur.
- Les trajectoires restent dans une petite plage confortable.
- Haut ne signifie jamais « meilleur ».
- Aucun bonus pour la hauteur maximale, le volume ou la durée extrême.
- Pas de cri ni de chuchotement prolongé.
- Les premiers sons utilisent plutôt une semi-occlusion douce : `mmm`, `vvv`, `zzz`, trille des lèvres ou `mmm–ou`.
- Les voyelles très ouvertes et fortes arrivent plus tard, brièvement et sans extrêmes.
- Des repos sont intégrés dans le gameplay.
- VoiceAct entraîne une voix saine et ne prétend pas traiter une pathologie.
