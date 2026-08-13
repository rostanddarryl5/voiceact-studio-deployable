# Analyse détaillée — VoiceAct UI Design Reference

Source analysée : `C:\Users\Rostand JK\Downloads\VoiceAct_UI_Design_Reference.html`

Date d’analyse : 14 juillet 2026

## Conclusion sincère

Le fichier HTML n’est pas une simple inspiration graphique. C’est pratiquement une spécification produit complète pour VoiceAct : identité visuelle, responsive desktop/mobile, parcours utilisateur, gamification, enregistrement vocal, feedback IA, progression, badges, abonnements, réglages et admin.

Ce que ce document clarifie fortement : VoiceAct ne doit pas ressembler à Remotion, ni à un éditeur vidéo/timeline. VoiceAct doit ressembler à une app SaaS d’entraînement vocal, premium, gamifiée, mobile-first mais parfaitement utilisable sur ordinateur.

L’image mentale correcte est plus proche de :

- Duolingo pour l’apprentissage vocal ;
- une app fitness/coach personnel pour la progression ;
- un mini studio de doublage simplifié pour la session ;
- un SaaS premium pour l’abonnement, le dashboard et l’admin.

## 1. Direction visuelle générale

### Ambiance

La référence impose une esthétique sombre, premium et légèrement gaming :

- fond principal très sombre violet/noir ;
- cartes sombres avec bordures violettes subtiles ;
- accents néon violet, lime, cyan, rose/corail et ambre ;
- glow léger sur les boutons importants ;
- beaucoup de cartes arrondies ;
- interface dense mais claire ;
- sensation “studio vocal moderne”, pas “outil de montage vidéo”.

### Palette importante

Le design system utilise une base sombre :

- `#0D0A1A` pour le fond profond ;
- `#161228` et `#1E1835` pour les cartes ;
- `#8B5CF6` comme violet principal ;
- `#A3E635` comme couleur de récompense / CTA fort ;
- `#F472B6`, `#22D3EE`, `#FBBF24` pour catégories, feedbacks et badges ;
- `#F0EBFF`, `#9D8EC4`, `#5B4F7A` pour les textes.

Notre interface actuelle beige/crème ne correspond donc pas à la référence. Elle peut être agréable, mais elle ne porte pas l’identité prévue.

### Typographie

La référence cherche une impression moderne et SaaS :

- titres lourds, très lisibles ;
- textes secondaires plus doux ;
- chiffres, scores et métriques avec une sensation plus technique ;
- hiérarchie forte entre titre, sous-titre, coach, consigne, métrique et CTA.

## 2. Responsive attendu

Le fichier montre deux choses distinctes :

### Desktop

Sur ordinateur, le logiciel doit être une vraie application web complète :

- sidebar fixe à gauche ;
- zone principale large ;
- dashboard structuré ;
- cartes de progression ;
- listes, grilles, graphiques et résultats bien alignés.

Il ne faut donc pas afficher une simple maquette mobile centrée sur PC.

### Mobile

Sur mobile, il ne faut pas seulement réduire le desktop. Il faut une expérience dédiée :

- header compact ;
- bottom navigation ;
- gros boutons tactiles ;
- textes lisibles ;
- exercices en cartes scrollables ;
- session d’enregistrement très focalisée ;
- feedback clair sans surcharge.

Le produit doit être responsive, mais surtout pensé mobile-first pour l’usage quotidien.

## 3. Navigation produit attendue

La référence contient les sections suivantes :

1. Design System
2. Landing Page
3. Authentification
4. Dashboard
5. Exercices
6. Session
7. Résultats
8. Progression
9. Badges
10. Abonnements
11. Réglages
12. Admin

Cela donne une structure produit beaucoup plus large que notre MVP actuel.

Pour le MVP 30 jours, toutes ces sections ne doivent pas forcément être complètes, mais l’architecture doit déjà les prévoir.

## 4. Écrans attendus, écran par écran

### Landing page

Objectif : convertir un visiteur en utilisateur.

Attendus :

- hero fort ;
- promesse claire ;
- CTA visible ;
- preuve sociale ;
- aperçu du produit ;
- pricing ou plans ;
- version mobile avec CTA visible rapidement.

Ce n’est pas prioritaire pour tester l’exercice vocal, mais c’est prioritaire pour rendre le SaaS marketable.

### Authentification

Attendus :

- inscription avec layout split : motif/branding à gauche, formulaire à droite ;
- connexion centrée ;
- option magic link ;
- expérience simple, premium, rassurante.

Pour le MVP local, on peut simuler le profil. Pour une mise marché, il faudra une vraie auth.

### Dashboard

Objectif : donner envie de revenir chaque jour.

Attendus desktop :

- sidebar fixe ;
- stats rapides ;
- exercices du jour ;
- activité récente ;
- extrait de leaderboard ;
- streak visible ;
- progression XP.

Attendus mobile :

- header avec streak ;
- statistiques compactes ;
- exercices du jour scrollables ;
- navigation basse.

Le dashboard est central pour l’effet Duolingo.

### Bibliothèque d’exercices

Objectif : choisir quoi pratiquer.

Attendus :

- recherche ;
- filtres par type ;
- filtres par difficulté ;
- filtres par catégorie/thématique ;
- cartes d’exercices ;
- badges de plan : gratuit, starter, pro ;
- état verrouillé pour certains exercices.

Pour VoiceAct, les catégories importantes sont par exemple :

- hook horreur ;
- documentaire ;
- histoire ;
- actualité ;
- doublage menace ;
- émotion triste ;
- ton épique ;
- voix publicitaire ;
- narration calme ;
- tension / suspense.

### Session d’enregistrement

Objectif : faire pratiquer l’utilisateur sans distraction.

C’est le cœur du produit.

Attendus :

- mode focus ;
- texte au centre ;
- consignes courtes ;
- timer ;
- waveform en temps réel ;
- bouton d’enregistrement rond, grand, lumineux ;
- état REC / STOP très clair ;
- affichage mobile très lisible ;
- espace pour guide de pause et d’intonation.

Notre app actuelle possède déjà l’enregistrement et l’analyse, mais l’UI doit être beaucoup plus proche d’un “studio d’entraînement vocal” que d’une page de test.

### Résultats

Objectif : transformer une prise vocale en apprentissage.

Attendus :

- score global très visible ;
- cercle de score ;
- feedback IA ;
- quatre dimensions principales ;
- badges débloqués ;
- prochaines actions.

Les quatre dimensions à stabiliser :

- Clarté ;
- Rythme ;
- Intonation ;
- Expressivité.

À cela, VoiceAct peut ajouter des sous-métriques spécifiques :

- respect des pauses ;
- variation d’énergie ;
- stabilité ;
- durée ;
- débit ;
- adaptation émotionnelle au genre.

### Progression

Objectif : rendre les progrès visibles.

Attendus :

- graphique sur 30 jours ;
- radar chart des 4 dimensions ;
- heatmap d’activité ;
- historique des sessions.

Ce bloc est très important pour la gamification : l’utilisateur doit voir qu’il s’améliore.

### Badges

Objectif : créer une collection et des micro-récompenses.

Attendus :

- badges gagnés ;
- badges en cours avec pourcentage ;
- badges verrouillés grisés ;
- logique de rareté/récompense.

Exemples adaptés à VoiceAct :

- “Silences maîtrisés” ;
- “Hook glaçant” ;
- “Voix documentaire crédible” ;
- “Rythme stable” ;
- “3 jours de suite” ;
- “Première prise pro” ;
- “Intonation expressive”.

### Abonnements

Objectif : monétisation SaaS.

Attendus :

- plans Free / Starter / Pro ;
- plan gate dans la bibliothèque ;
- bénéfices lisibles ;
- billing portal plus tard ;
- historique de facturation plus tard.

Pour le MVP, il faut au minimum que l’interface prépare les plans, même si le paiement réel vient ensuite.

### Réglages

Attendus :

- profil ;
- préférences d’entraînement ;
- notifications ;
- confidentialité ;
- export/suppression des données.

Ce n’est pas prioritaire pour la première démo, mais nécessaire pour un vrai SaaS.

### Admin

Attendus :

- backoffice interne ;
- KPIs business ;
- gestion utilisateurs ;
- CRUD exercices ;
- accès réservé à des emails admin.

Pour le MVP, on peut d’abord gérer les exercices en dur dans le code. Mais à moyen terme, un admin est indispensable pour enrichir vite la base d’exercices.

## 5. Composants visuels clés à reproduire

### App shell desktop

- sidebar sombre ;
- logo VoiceAct ;
- navigation verticale ;
- état actif violet ;
- profil utilisateur en bas ;
- contenu principal à droite.

### App shell mobile

- header compact ;
- streak visible ;
- contenu vertical ;
- bottom nav fixe ;
- boutons suffisamment grands pour le pouce.

### Cartes d’exercices

- carte sombre ;
- titre fort ;
- catégorie ;
- difficulté ;
- XP ;
- badge de plan ;
- état actif ou verrouillé ;
- hover sur desktop.

### Bouton d’enregistrement

- gros bouton rond ;
- gradient violet ;
- glow ;
- animation pendant REC ;
- état STOP évident.

### Waveform

La waveform est un élément d’identité. Elle doit apparaître :

- dans la marque ;
- dans la session ;
- dans les résultats ;
- éventuellement dans les cartes audio.

### Score circle

Le cercle de score donne une lecture immédiate :

- score global ;
- couleur selon niveau ;
- sensation de récompense.

### XP/Streak

La gamification doit être visible partout :

- streak ;
- XP ;
- niveau ;
- progression vers prochain niveau ;
- récompenses après session.

## 6. Fonctionnalités implicites à construire

Le HTML implique ces fonctionnalités, même si elles ne sont pas toutes “branchées” dans le fichier :

1. Compte utilisateur
2. Profil d’apprentissage
3. Parcours quotidien
4. Bibliothèque d’exercices
5. Filtres et recherche
6. Enregistrement micro
7. Analyse audio
8. Feedback IA
9. Notation multi-dimensions
10. XP
11. Streak
12. Niveaux
13. Badges
14. Historique des sessions
15. Graphiques de progression
16. Plans d’abonnement
17. Exercices verrouillés par plan
18. Réglages
19. Admin exercices
20. KPIs internes

## 7. Écart avec notre app actuelle

Notre app actuelle a déjà une bonne base fonctionnelle :

- exercices ;
- segments ;
- pauses attendues ;
- courbe d’intonation ;
- enregistrement micro ;
- niveau audio live ;
- analyse de la prise ;
- score ;
- conseils ;
- XP/streak embryonnaire.

Mais elle n’est pas encore alignée avec la référence sur :

- design sombre premium ;
- sidebar desktop ;
- bottom nav mobile ;
- dashboard complet ;
- bibliothèque filtrable ;
- mode session réellement immersif ;
- résultats type SaaS/gamification ;
- progression 30 jours ;
- badges collectionnables ;
- pricing ;
- réglages ;
- admin.

Donc le moteur existe en partie, mais l’emballage produit et le parcours utilisateur doivent être repris plus sérieusement.

## 8. Décision produit recommandée

Pour rester dans l’objectif “Duolingo du doublage” en 30 jours, il ne faut pas essayer de tout construire tout de suite.

Il faut construire une version marketable qui donne l’illusion d’un produit complet, mais avec un cœur fonctionnel solide.

Priorité MVP :

1. App shell responsive desktop/mobile ;
2. Dashboard gamifié ;
3. Bibliothèque d’exercices ;
4. Session d’enregistrement premium ;
5. Analyse audio + score 4 dimensions ;
6. Résultats + conseils ;
7. XP/streak/badges simples ;
8. Progression locale ;
9. Landing page ;
10. Préparation pricing/auth.

Auth, paiement réel, admin complet et base distante peuvent venir après si la démo est convaincante.

## 9. Traduction concrète pour la prochaine étape de développement

La prochaine étape logique n’est pas d’ajouter encore plus d’analyse audio. C’est de refondre l’interface autour de la référence.

À faire maintenant :

1. Créer un vrai design system CSS sombre avec les couleurs de référence.
2. Créer un layout desktop avec sidebar.
3. Créer un layout mobile avec bottom nav.
4. Remplacer la page unique actuelle par une expérience en sections :
   - dashboard ;
   - exercices ;
   - session ;
   - résultats ;
   - progression ;
   - badges.
5. Garder le moteur audio existant, mais le replacer dans le nouvel écran Session.
6. Ajouter les scores Clarté / Rythme / Intonation / Expressivité.
7. Ajouter la présentation des pauses et de l’intonation dans le style “studio pédagogique”.

## 10. Règle de conception à retenir

VoiceAct doit être :

- normal et confortable sur PC ;
- magnifique et très pratique sur mobile ;
- gamifié sans devenir enfantin ;
- premium sans être froid ;
- pédagogique sans donner l’impression d’un cours scolaire ;
- orienté voix, émotion, rythme, pause et intention.

La référence HTML confirme exactement cette direction.

