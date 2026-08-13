# Droit d'auteur, données vocales et AI Act

Ce document est une spécification de prudence produit, pas un avis juridique. Une validation par un juriste français spécialisé audiovisuel/données est nécessaire avant commercialisation.

## Contenus audiovisuels

Le fait qu'une vidéo, un film, un script ou des sous-titres soient accessibles en ligne n'accorde pas le droit de les reproduire dans VoiceAct.

Pour le catalogue payant, autoriser seulement :

- contenus créés par VoiceAct avec cession adaptée ;
- contenus sous licence permettant l'usage commercial et les adaptations ;
- contenus du domaine public dans les territoires servis ;
- contenus couverts par un contrat partenaire explicite.

Les exceptions d'enseignement françaises sont encadrées et visent notamment un but non commercial ou des établissements/espaces sécurisés. Elles ne constituent pas une base suffisante pour un SaaS commercial grand public.

Sources :

- [Code de la propriété intellectuelle, article L.122-5 et suivants](https://www.legifrance.gouv.fr/loda/id/LEGISCTA000006146348)
- [Article L.122-5-4 relatif à l'enseignement et à la formation](https://www.legifrance.gouv.fr/loda/id/LEGISCTA000006146377)
- [YouTube — le créateur détient généralement le copyright de sa vidéo](https://support.google.com/youtube/answer/2797466)
- [YouTube — téléchargement limité notamment à ses propres vidéos](https://support.google.com/youtube/answer/56100)

## Transcriptions et timestamps

Un timestamp est factuel, mais une transcription reproduit l'expression protégée. La base doit donc distinguer :

- métadonnées et statistiques ;
- courts repères nécessaires à la recherche interne ;
- scripts complets ;
- fichiers audio/vidéo ;
- caractéristiques acoustiques dérivées.

Chaque niveau reçoit un statut de droit et une politique de conservation. « Disponible dans un dataset de recherche » ne signifie pas « intégrable commercialement ».

## Voix des utilisateurs

Un enregistrement vocal relatif à une personne est une donnée personnelle. Il devient potentiellement une donnée biométrique sensible lorsqu'il sert à identifier une personne de manière unique.

VoiceAct doit prévoir :

- consentement et finalités claires ;
- durée de conservation configurable ;
- suppression du compte et des prises ;
- export des données ;
- chiffrement en transit et au repos ;
- séparation entre audio brut et métriques ;
- interdiction d'entraîner un modèle sur les prises sans consentement séparé ;
- minimisation : supprimer l'audio quand seules les métriques sont nécessaires ;
- politique spécifique pour les mineurs.

Source : [CNIL — les enregistrements sonores de voix sont des données personnelles](https://www.cnil.fr/fr/identifier-les-donnees-personnelles).

## Ne pas « reconnaître l'émotion intérieure »

L'AI Act définit la reconnaissance des émotions comme l'identification ou l'inférence d'émotions ou d'intentions à partir de données biométriques, y compris certaines caractéristiques de la voix. Son usage est interdit dans les lieux de travail et établissements d'enseignement, sauf raisons médicales ou de sécurité, et encadré ailleurs.

VoiceAct doit donc être conçu et présenté comme un système de comparaison de performance :

- cible demandée : rythme, hauteur, énergie, pauses ;
- mesures observables ;
- correspondance avec une référence ;
- aucune affirmation sur l'état mental réel ;
- explication des limites et de la confiance.

Formulation sûre : « La courbe de ta prise correspond peu à la courbe descendante demandée. »

Formulation à proscrire : « Le logiciel détecte que tu n'es pas réellement triste. »

Source : [Règlement européen 2024/1689, notamment article 5 et définition des systèmes de reconnaissance des émotions](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689).

## Registre de provenance obligatoire

Pour chaque exercice :

```json
{
  "sourceId": "...",
  "title": "...",
  "rightsHolder": "...",
  "license": "...",
  "territories": ["FR", "EU"],
  "commercialUse": true,
  "derivativesAllowed": true,
  "audioAllowed": true,
  "videoAllowed": true,
  "transcriptAllowed": true,
  "modelTrainingAllowed": false,
  "attribution": "...",
  "expiry": null,
  "proofDocument": "...",
  "reviewedBy": "...",
  "reviewDate": "..."
}
```

Un exercice sans provenance validée reste en brouillon et ne peut pas être publié.
