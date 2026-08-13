# Audit des exigences VoiceAct

Date : 16 juillet 2026.

Ce document relie les demandes produit exprimées pendant la conception à leur état réel dans le logiciel. Une exigence n'est marquée `VALIDÉE` que si elle est implémentée et vérifiée. `PARTIELLE` signifie que la carrosserie existe, mais qu'une validation métier, un corpus ou une infrastructure manque encore.

## Parcours utilisateur

| Exigence | État | Preuve actuelle | Reste à faire |
|---|---|---|---|
| Commencer uniquement avec Créateur vidéo et Doublage cinéma | VALIDÉE | Deux choix seulement dans l'onboarding ; deux pistes de cursus distinctes | Enrichir chaque piste sans ajouter de nouvel objectif MVP |
| Poser une question à la fois | VALIDÉE | Trois écrans successifs : objectif, niveau, rythme | Tester avec de vrais utilisateurs |
| Passer automatiquement à la question suivante | VALIDÉE | La réponse déclenche la transition après 360 ms, sans bouton Continuer | Ajouter retour haptique en PWA si pertinent |
| Onboarding jovial et animé | PARTIELLE | Mascotte VA, halo, rebond, transitions de carte | Remplacer la mascotte provisoire par un personnage animé validé par la direction artistique |
| Ne révéler aucune fonctionnalité avant le diagnostic | VALIDÉE | Navigation, XP, streak, Studio et Résultats sont cachés jusqu'au diagnostic validé | Ajouter l'inscription réelle avant l'onboarding |
| Afficher uniquement l'exercice de base après les questions | VALIDÉE | Écran compact : intention, texte et accès au studio | Test d'intelligibilité utilisateur |
| Le diagnostic ne doit pas bloquer selon la note | VALIDÉE | Une analyse fiable crée la baseline quel que soit le score | Prévoir un traitement humain des prises techniquement inexploitables |
| Révéler ensuite le cursus complet | VALIDÉE | Le plan est révélé après création de la baseline | Affiner la représentation du plan après tests UX |
| Débloquer progressivement les exercices | VALIDÉE | Seule la première étape de la piste, la recommandation et les étapes déjà réussies sont accessibles | Ajouter davantage d'étapes par piste |

## Studio guidé

| Exigence | État | Preuve actuelle | Reste à faire |
|---|---|---|---|
| Texte horizontal de droite à gauche | VALIDÉE | Ruban temporel horizontal animé | Tester sur davantage de téléphones bas de gamme |
| Barre rouge fixe à gauche | VALIDÉE | Repère placé à 11 % de la largeur | Calibrer cette avance de lecture avec des apprenants |
| Travailler par phrases et intentions, pas mot à mot | VALIDÉE | Une carte temporelle par groupe de sens | Ajouter un véritable segmenteur syntaxique français côté back-office |
| Taille du texte liée à l'énergie attendue | VALIDÉE | Quatre niveaux : bas, contenu, moyen, fort | Validation perceptive avec comédiens |
| Espaces liés aux silences | VALIDÉE | La largeur parlée et la zone de silence partagent la même échelle temporelle | Ajouter symboles de souffle et vocalisations |
| Vitesse liée au style et à l'émotion | PARTIELLE | Durée calculée par syllabes françaises, WPM du genre et multiplicateur local de rythme | Remplacer l'estimation par les timestamps d'une référence professionnelle quand elle existe |
| Défilement fluide | VALIDÉE TECHNIQUEMENT | Translation pilotée par `requestAnimationFrame`, sans rendu React à chaque frame | Mesurer la fluidité sur Android d'entrée de gamme |
| Courbe d'intonation simple | VALIDÉE | Six contours pédagogiques visibles | Afficher après la prise la courbe cible et la courbe réellement produite |
| Commande d'enregistrement proche du prompteur | VALIDÉE | Barre d'action mobile située immédiatement après le ruban et collante au défilement | Test manuel du micro sur iOS Safari et Android Chrome |

## Analyse vocale

| Exigence | État | Preuve actuelle | Reste à faire |
|---|---|---|---|
| Transcription locale gratuite | VALIDÉE | `faster-whisper-small`, CPU int8, API locale | Benchmark GPU de production |
| Timestamps par mot | VALIDÉE | 26 mots français horodatés lors du test réel | Ajouter alignement phonémique |
| Empêcher tiny de valider | VALIDÉE | Garde explicite dans le moteur et test automatisé | Aucun |
| Mesurer silences, volume, bruit et saturation | VALIDÉE TECHNIQUEMENT | Analyse PCM locale, intervalles vocaux, dBFS, clipping ; dynamique voisée calculée par Praat | Calibrer les seuils sur un corpus de contrôle |
| Mesurer hauteur et courbe | VALIDÉE TECHNIQUEMENT | Praat-Parselmouth côté serveur, F0 toutes les 10 ms, médiane, étendue P10-P90, taux voisé et HNR ; le navigateur ne sert plus de référence validante | Calibrer les seuils selon profils de voix et conditions mobiles |
| Mesurer la diction | PARTIELLE | Alignement éditionnel des mots reconnus avec le texte attendu | Montreal Forced Aligner ou modèle phonémique français |
| Mesurer une émotion de façon juste | PARTIELLE | Comparaison de paramètres observables à une direction cible ; aucune prétention psychologique | Corpus français professionnel annoté et accord inter-évaluateurs |
| Score pédagogique fiable | PARTIELLE | Score segment par segment, confiance, refus de validation si mesure faible | Calibration statistique sur prises notées par professionnels |
| Adapter le prochain exercice aux faiblesses | VALIDÉE LOGIQUEMENT | Choix selon clarté, rythme, intonation, expressivité et objectif | Valider les règles sur données longitudinales réelles |

## Progression et produit

| Exigence | État | Preuve actuelle | Reste à faire |
|---|---|---|---|
| Conserver la première prise | VALIDÉE LOCALEMENT | Audio et analyse dans IndexedDB ; baseline persistante | Stockage chiffré serveur et consentement |
| Comparer les prises | VALIDÉE | Avant, maintenant et delta par exercice | Comparaison audio A/B plus accessible |
| Refaire le même diagnostic après un mois | PARTIELLE | La baseline et sa date sont conservées | Planificateur J+30, notification et écran avant/après |
| Gamification utile | PARTIELLE | XP, streak, badges et déblocage | Relier chaque récompense à une compétence et tester la motivation à long terme |
| Responsive ordinateur et mobile | VALIDÉE SUR LES ÉCRANS TESTÉS | Audits 380×844, 1280×720 et 1440×900 | Matrice Safari iOS, Chrome Android, tablettes et accessibilité WCAG |
| Mise en ligne solide | PARTIELLE | Docker, health checks, service local sans API payante | Authentification, base serveur, stockage objet, file de tâches, monitoring et sauvegardes |

## Base de connaissances

État honnête : `SOLIDE POUR UN PROTOTYPE`, mais `INSUFFISANTE POUR PRÉTENDRE À UNE NOTATION PROFESSIONNELLE`.

La base contient actuellement :

- principes de prosodie, débit, pauses et intonation ;
- catalogue structuré de corpus et statut juridique ;
- règles de doublage et de voix off ;
- moteur de direction vocale ;
- UX mobile et gamification ;
- garde-fous droits d'auteur, vie privée et IA ;
- sept exercices exécutables, dont un diagnostic.

Avant commercialisation, il faut encore :

1. vingt à trente exercices validés par piste pour le MVP ;
2. trois à cinq prises professionnelles par exercice ;
3. une annotation manuelle des intentions, syllabes, accents, pauses et contours ;
4. un corpus d'étalonnage francophone couvrant accents, genres de voix, micros et bruits ;
5. des notes humaines en double aveugle pour mesurer la corrélation avec VoiceAct ;
6. une revue juridique fichier par fichier ;
7. un registre de version : auteur, preuve, licence, validation et date de révision pour chaque exercice.

## Règle de livraison

Une interface visible ne suffit jamais à déclarer une fonctionnalité terminée. Chaque future étape doit comporter :

1. logique métier documentée ;
2. implémentation ;
3. test automatisé lorsque possible ;
4. test visuel ordinateur et mobile ;
5. test avec un vrai fichier audio ;
6. limites connues inscrites dans cet audit.
