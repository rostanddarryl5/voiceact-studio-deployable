# VoiceAct — état production

## Déjà fait

- Interface web déployée sur Vercel :
  - `https://voiceact-vercel-deploy.vercel.app`
- Build Next.js validé localement.
- Backend vocal public préparé pour Render :
  - Dockerfile unique MFA + Speech API.
  - Blueprint Render.
  - Script de raccordement Vercel.

## À faire maintenant

1. Mettre `voiceact-studio` dans un repo GitHub.
2. Créer le service Render via `render.yaml`.
3. Récupérer l’URL Render et `VOICEACT_INTERNAL_TOKEN`.
4. Lancer `scripts/connect_vercel_backend.ps1`.
5. Tester une vraie analyse vocale depuis le lien Vercel.

## Important

Le backend vocal est la partie lourde du produit. Le frontend est stable, mais l’analyse vocale ne sera vraiment testable à distance qu’après raccordement Render.
