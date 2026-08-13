# Déploiement du moteur vocal VoiceAct sur Render

Ce document décrit le déploiement du backend vocal public qui doit alimenter l’app Vercel.

Frontend déjà déployé :

```text
https://voiceact-vercel-deploy.vercel.app
```

## Architecture retenue

Pour le MVP, on déploie un seul service Docker nommé `voiceact-analysis`.

À l’intérieur du même conteneur :

1. MFA démarre en privé sur `127.0.0.1:8020`.
2. Le Speech API démarre publiquement sur `$PORT`.
3. Vercel appelle uniquement le Speech API public.

Cette architecture évite de payer et maintenir deux services séparés dès le départ.

## Fichiers importants

- `Dockerfile.analysis` : image Docker du backend vocal public.
- `Dockerfile.analysis.dockerignore` : contexte Docker léger pour ce backend.
- `deploy/start-analysis.sh` : lance MFA puis le Speech API.
- `render.yaml` : blueprint Render.
- `scripts/connect_vercel_backend.ps1` : raccorde Vercel au backend Render.

## Déploiement Render

1. Pousser le dossier `voiceact-studio` vers GitHub.
2. Dans Render, choisir **New > Blueprint**.
3. Sélectionner le repo qui contient `render.yaml`.
4. Laisser Render créer le service `voiceact-analysis`.
5. Attendre le premier build. Il peut être long, car MFA et les modèles français sont lourds.

## Variables Render

Le fichier `render.yaml` prévoit :

```text
VOICEACT_MODEL_SIZE=tiny
VOICEACT_DEVICE=cpu
VOICEACT_COMPUTE_TYPE=int8
VOICEACT_ALIGNMENT=mfa
VOICEACT_MAX_CONCURRENCY=1
VOICEACT_PRELOAD_MODEL=false
```

Render doit aussi demander :

```text
VOICEACT_INTERNAL_TOKEN
```

Colle une valeur longue et garde-la secrète : elle sert à protéger l’API vocale et devra être recopiée côté Vercel.

## Raccorder Vercel après le déploiement Render

Quand Render donne une URL du type :

```text
https://voiceact-analysis.onrender.com
```

Lancer depuis PowerShell :

```powershell
cd "C:\Users\Rostand JK\Desktop\Voice act\voiceact-studio"
.\scripts\connect_vercel_backend.ps1 `
  -BackendUrl "https://voiceact-analysis.onrender.com" `
  -InternalToken "COLLER_LE_TOKEN_RENDER_ICI"
```

Le script configure côté Vercel :

```text
VOICEACT_TRANSCRIPTION_PROVIDER=local
VOICEACT_SPEECH_SERVICE_URL=https://voiceact-analysis.onrender.com
VOICEACT_SPEECH_SERVICE_TOKEN=<token Render>
VOICEACT_ALLOW_OPENAI_FALLBACK=false
```

Puis il redéploie l’app Vercel.

## Ce qui est attendu après raccordement

Sur Vercel :

```text
/api/health
```

doit passer de `degraded/offline` à `ready/standard` ou `ready/advanced`.

`advanced` signifie que MFA est disponible pour la précision phonétique.

## Notes réalistes

- La version gratuite Render démarre avec `tiny` pour éviter la carte bancaire et limiter la RAM.
- Pour le vrai moteur VoiceAct, repasser ensuite à `small` ou mieux quand on prend un plan payant.
- Le premier démarrage peut être long.
- Pour un vrai SaaS, il faudra ensuite ajouter une file d’attente, une limite par utilisateur, et du stockage durable des prises audio.
