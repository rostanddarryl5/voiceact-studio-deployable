# VoiceAct — Architecture produit maître

Date : 15 juillet 2026

## 1. Positionnement

VoiceAct est un coach vocal intelligent pour :

- créateurs vidéo ;
- apprentis doubleurs ;
- narrateurs ;
- voix off publicitaires ;
- personnes qui veulent améliorer diction, rythme, expressivité et présence vocale.

VoiceAct ne doit pas être une simple bibliothèque d’exercices. Le produit doit agir comme un coach :

1. comprendre l’objectif utilisateur ;
2. mesurer son niveau initial ;
3. construire un cursus progressif ;
4. noter les prises ;
5. détecter les faiblesses ;
6. recommander la suite ;
7. montrer les progrès dans le temps.

## 2. Promesse centrale

“VoiceAct analyse ta voix, identifie ce qui bloque ta progression, puis te fait pratiquer avec des exercices de doublage, narration et voix off adaptés à ton niveau.”

## 3. Expérience utilisateur cible

### Étape 1 — Inscription / profil

L’utilisateur indique :

- objectif principal ;
- niveau ressenti ;
- type de voix à travailler ;
- fréquence souhaitée ;
- préférence : créateur vidéo, doublage, documentaire, publicité.

Dans le prototype actuel, on a déjà une première version locale de cette étape dans l’écran Diagnostic.

### Étape 2 — Diagnostic initial

VoiceAct propose un texte de référence avec :

- ton ;
- émotion ;
- pauses ;
- intonation ;
- mots à accentuer.

L’utilisateur enregistre une première prise. Cette prise devient la baseline.

### Étape 3 — Cursus progressif

Les exercices ne sont pas tous libres immédiatement.

Chaque exercice a :

- un objectif ;
- une compétence principale ;
- un niveau ;
- une note de passage ;
- des prérequis ;
- des points de focus ;
- des critères de réussite.

### Étape 4 — Résultats intelligents

Après une prise, VoiceAct affiche :

- score global ;
- validation ou non de l’étape ;
- force principale ;
- faiblesse principale ;
- conseil de reprise ;
- prochaine action ;
- XP et badge.

### Étape 5 — Adaptation du cursus

Les résultats doivent orienter le prochain exercice :

- faiblesse en rythme → exercices de débit / pauses ;
- faiblesse en clarté → diction / articulation ;
- faiblesse en intonation → courbes vocales / imitation ;
- faiblesse en expressivité → émotions / intention / doublage.

### Étape 6 — Réévaluation

Après environ 30 jours, l’utilisateur relit un texte comparable au diagnostic initial. VoiceAct montre :

- score avant/après ;
- progression par compétence ;
- extraits audio comparables ;
- badge de progression ;
- recommandations suivantes.

## 4. Modules produit

### Diagnostic

Rôle : créer la baseline.

Contient :

- questionnaire ;
- texte de référence ;
- consignes de voix ;
- première analyse ;
- score initial.

### Cursus

Rôle : organiser la progression.

Contient :

- liste d’exercices ;
- logique de déblocage ;
- note de passage ;
- prérequis ;
- meilleur score par exercice.

### Studio

Rôle : pratiquer.

Contient :

- texte à lire ;
- intonation attendue ;
- pauses ;
- métronome émotionnel ;
- bouton REC ;
- waveform ;
- prise active ;
- analyse.

### Résultats

Rôle : transformer la prise en apprentissage.

Contient :

- score ;
- dimensions ;
- force ;
- faiblesse ;
- recommandation ;
- validation ;
- prochaine étape.

### Progression

Rôle : prouver que VoiceAct fonctionne.

Contient :

- historique ;
- progression 30 jours ;
- avant/après ;
- radar des compétences ;
- badges.

## 5. Dimensions évaluées

Le MVP utilise quatre dimensions principales :

1. Clarté
2. Rythme
3. Intonation
4. Expressivité

Sous-métriques possibles :

- volume utile ;
- stabilité ;
- débit ;
- nombre de pauses ;
- ratio de silence ;
- variation d’énergie ;
- respect du rythme cible ;
- intensité émotionnelle.

## 6. Types d’exercices

### Diagnostic

Mesure initiale.

### Diction

Articulation, consonnes, projection.

Exemples :

- lire lentement en exagérant les consonnes ;
- parler avec un stylo dans la bouche comme exercice hors prise ;
- lire ensuite sans stylo pour mesurer la différence.

### Rythme / pauses

Gestion du silence et des groupes de sens.

### Intonation

Courbes vocales, montée/descente, fin de phrase.

### Émotion

Tristesse, peur, menace, autorité, enthousiasme.

### Imitation voix pro

L’utilisateur écoute une voix de référence autorisée, puis reproduit :

- rythme ;
- pauses ;
- émotion ;
- courbe ;
- intensité.

Important : toute voix de référence doit être licenciée, créée par nous, ou explicitement autorisée.

## 7. Architecture code décidée

Le code doit être organisé autour de trois couches :

### Données pédagogiques

Fichier actuel :

- `src/lib/lessons.ts`

Contient les exercices, textes, segments, consignes, émotions et critères.

### Règles métier

Fichier actuel :

- `src/lib/curriculum.ts`

Contient :

- sections ;
- filtres ;
- note de passage ;
- dimensions ;
- déblocage ;
- recommandations.

### Interface

Fichier actuel :

- `src/app/page.tsx`

Doit surtout afficher les écrans et appeler les règles métier. Il ne doit plus contenir toute la logique produit.

## 8. Règles de développement à partir de maintenant

1. Ne plus patcher l’UI au hasard.
2. Toute nouvelle fonctionnalité doit correspondre à un module produit clair.
3. Les règles métier vont dans `curriculum.ts` ou un module dédié.
4. Les exercices vont dans `lessons.ts` ou une future base de données.
5. L’UI affiche ; elle ne doit pas devenir le cerveau du produit.
6. Chaque écran doit être testé sur desktop et mobile.
7. Les exercices pédagogiques doivent être documentés et justifiés.

## 9. Prochaines fondations à construire

1. Historique des prises.
2. Recommandation de prochain exercice basée sur la faiblesse dominante.
3. Exercice d’imitation avec voix de référence.
4. Écran progression avant/après.
5. Base de connaissances pédagogique par rubrique.
6. Authentification et stockage utilisateur.
7. Admin pour ajouter/modifier les exercices.

