# Références cinéma et créateurs — protocole VoiceAct

## Règle de fond

Une scène ou une vidéo publique n'est pas automatiquement réutilisable dans un SaaS payant. Cette base sépare :

1. la référence stylistique, qui peut être étudiée ;
2. les caractéristiques dérivées, à valider juridiquement ;
3. le texte, l'audio et la vidéo, qui exigent une licence ou un statut ouvert ;
4. les exercices VoiceAct, qui doivent être originaux ou licenciés.

Nous ne stockons pas ici les scripts complets ni des transcriptions massives de créateurs.

## Scènes cultes à analyser, sans intégration directe

Ces scènes couvrent des gestes vocaux utiles. Les timestamps doivent être obtenus sur une édition précise et validés ; un même film possède plusieurs montages, doublages et cadences vidéo.

| Œuvre / scène | Compétence vocale | Ce qu'il faut mesurer | Statut |
|---|---|---|---|
| Le Parrain — menace calme de Don Corleone | autorité sans volume | F0 basse relative, débit, pauses, chute | référence uniquement |
| Taken — appel téléphonique | menace contrôlée puis certitude | montée d'énergie, mots pivots, durée des silences | référence uniquement |
| The Dark Knight — interrogatoire/Joker | imprévisibilité contrôlée | ruptures de rythme, rires, souffle, attaques | référence uniquement |
| Gladiator — révélation d'identité | colère contenue et fierté | build, accentuation nominale, fin ferme | référence uniquement |
| Le Seigneur des anneaux — confrontation de Gandalf | commandement/climax | intensité, allongement, attaque, réverbération à ignorer | référence uniquement |
| Le Diable s'habille en Prada — monologue du « cerulean » | domination intellectuelle froide | débit stable, faible pause, précision | référence uniquement |
| A Few Good Men — explosion au tribunal | escalade vers le cri | pente d'énergie et de F0, articulation sous intensité | référence uniquement |
| Good Will Hunting — répétition thérapeutique | répétition avec évolution | micro-variations, silences, fragilité | référence uniquement |
| Rocky Balboa — discours au fils | motivation intime | gravité, accélération, accents, chute | référence uniquement |
| Pulp Fiction — tirade rituelle | rythme, tension et climax | groupes prosodiques, pauses de domination | référence uniquement |
| La Haine — scènes de confrontation | tension réaliste | chevauchements, débit spontané, accent régional | référence uniquement |
| Les Tontons flingueurs — échanges ciselés | sous-texte et timing comique | temps de réponse, sécheresse des attaques | référence uniquement |
| Astérix & Obélix : Mission Cléopâtre — monologues comiques | rupture et musicalité comique | accélérations, pauses d'effet, changements d'adresse | référence uniquement |
| Intouchables — confrontations légères | naturel conversationnel | sourire vocal, chevauchement, spontanéité | référence uniquement |

Pour automatiser la recherche de scènes, MovieNet fournit une méthode d'alignement script–sous-titre–timeline, et SAM décrit un alignement audio–sous-titre jusqu'aux frontières de mots. Ces données restent des ressources de recherche, pas un catalogue de contenus licenciés.

## Premiers films réellement candidats au produit

### Blender Open Movies

- Sintel : narration intime, douleur, révélation, appel et affrontement ;
- Tears of Steel : dialogue live-action, urgence, relation et science-fiction ;
- Cosmos Laundromat : personnage, humour, fatigue et surprise ;
- Agent 327: Operation Barbershop : comédie, action et rythme ;
- Spring : peu de dialogue mais travail du souffle et de la réaction.

Chaque projet doit faire l'objet d'une fiche séparée : URL source, licence exacte, attribution requise, fichiers audio, sous-titres, langue, durée, personnages et scènes retenues.

Source de départ : [chaîne officielle Blender Open Movies](https://video.blender.org/c/blender_open_movies/videos). Tears of Steel annonce le film et les rushes sous [Creative Commons Attribution](https://mango.blender.org/about/).

### Corpus VoiceAct original

Le corpus propriétaire doit devenir notre meilleure source :

- 20 textes neutres joués dans 8 intentions ;
- 10 comédiens minimum au départ ;
- 3 intensités ;
- version libre puis version contrainte en durée ;
- timestamps mot, groupe de sens et pause ;
- validation par auditeurs et directeur artistique ;
- contrat couvrant entraînement, diffusion dans le SaaS et dérivés analytiques.

## Créateurs francophones à étudier

| Domaine | Références | Caractéristiques à mesurer |
|---|---|---|
| Horreur/mystère | Feldup, McSkyz, Victoria Charlton | lenteur locale, silences, proximité micro, ruptures, révélations |
| Histoire | Nota Bene, Sur le Champ, C'est une autre histoire | crédibilité, densité informationnelle, transitions, noms propres |
| Actualité | HugoDécrypte, Gaspard G | débit, concision, attaque, relances et neutralité engagée |
| Storytelling | TheGreatReview, Poisson Fécond | arcs longs, changements de tension, respiration narrative |
| Science/espace | Balade Mentale, ScienceEtonnante, Le Sense of Wonder | pédagogie, émerveillement, gestion des termes techniques |
| Tech | Micode, Underscore_ | autorité accessible, énergie conversationnelle, précision |

Sources officielles disponibles : [Nota Bene](https://www.notabenemovies.com/), [HugoDécrypte](https://hugodecrypte.kessel.media/posts), [FeldupTV](https://www.felduptv.com/).

## Références internationales

| Domaine | Références | Caractéristiques à mesurer |
|---|---|---|
| Mystère/horreur | LEMMiNO, Nexpo, MrBallen | tension, révélation, proximité et rythme narratif |
| Documentaire/explainer | Johnny Harris, Vox, Wendover Productions, RealLifeLore | densité, transitions, mise en évidence des faits |
| Science | Kurzgesagt, Veritasium, Vsauce, Cleo Abram | enthousiasme crédible, explication et curiosité |
| Business | ColdFusion, MagnatesMedia | gravité, narration de trajectoire, chiffres |
| Storytelling visuel | Fern, neo | retenue, cinématique, silences et montage |

## Protocole d'analyse d'une vidéo de créateur

1. conserver uniquement URL, titre, auteur, date, langue et statut de licence ;
2. ne télécharger que si le créateur l'autorise ou fournit le fichier ;
3. extraire localement les timestamps sur une copie autorisée ;
4. segmenter hook, installation, développement, pivot, climax et conclusion ;
5. calculer WPM, syllabes/s, articulation/s, pauses, F0 et énergie par segment ;
6. annoter l'intention par au moins deux évaluateurs ;
7. stocker des statistiques agrégées et non le texte/audio si les droits ne couvrent pas l'intégration ;
8. produire un exercice original reproduisant le geste vocal, jamais la formulation protégée ;
9. si la vidéo doit être jouée dans l'app, signer une licence avec le créateur.

## Programme partenaires créateurs

Le moyen le plus solide d'obtenir une grande base pertinente est un programme d'opt-in :

- le créateur fournit cinq à vingt extraits sources et leurs scripts ;
- VoiceAct réalise l'alignement et la partition ;
- le créateur valide les intentions ;
- l'exercice est crédité et peut partager des revenus ;
- le contrat précise durée, territoires, supports, entraînement de modèles et retrait ;
- aucune imitation d'identité vocale ni clonage sans autorisation séparée.

Cette stratégie produit des exercices exclusifs, commercialisables et pédagogiquement validés, là où le simple scraping crée une dette juridique et des données bruyantes.
