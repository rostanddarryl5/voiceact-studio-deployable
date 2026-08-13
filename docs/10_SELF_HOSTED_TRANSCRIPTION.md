# Moteur vocal auto-hébergé et déploiement

## Décision d'architecture

VoiceAct utilise désormais deux services séparés :

1. **L'application Next.js** orchestre l'exercice, l'enregistrement, la notation et l'interface.
2. **Le service vocal Python** transcrit avec `faster-whisper` et affine les horodatages avec WhisperX lorsque celui-ci est disponible.

Le navigateur ne contacte jamais directement un fournisseur d'IA. Il envoie l'audio à la route Next.js `/api/voice-analysis/transcribe`; celle-ci appelle le service Python sur le réseau privé. Le contrat JSON reste identique quel que soit le fournisseur. On peut donc changer de machine ou ajouter un GPU sans modifier l'interface.

Le secours OpenAI est **désactivé par défaut**. Il ne peut consommer des crédits que si les deux conditions sont réunies :

- `VOICEACT_ALLOW_OPENAI_FALLBACK=true`;
- `OPENAI_API_KEY` contient une clé valide.

## Ce que le moteur mesure réellement

- `faster-whisper` : texte, langue, timestamps des mots, probabilité des mots et filtrage des silences;
- WhisperX : alignement forcé plus précis des mots, utile pour mesurer le retard, le débit et les pauses;
- moteur Web Audio existant : énergie, volume, clipping, silences, hauteur et variation de hauteur;
- moteur VoiceAct : compare ces observations aux intentions pédagogiques du segment.

WhisperX n'est pas utilisé pour deviner magiquement une émotion. L'émotion est évaluée à partir de critères observables et annoncés : énergie, registre, contour mélodique, débit, pauses, accentuation et fidélité au texte.

Le texte attendu n'est pas envoyé comme transcription imposée. Cela évite que le moteur « voie » la bonne réponse et crédite à tort des mots qui n'ont pas été prononcés.

## Développement local

Prérequis : Python 3.11, FFmpeg et Node.js. Docker n'est nécessaire que pour reproduire l'environnement de production.

```powershell
cd speech-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-whisperx.txt
Copy-Item ..\.env.example ..\.env.local
$env:VOICEACT_INTERNAL_TOKEN="changez-ce-secret"
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Dans un second terminal :

```powershell
npm run dev
```

Au premier lancement, le modèle est téléchargé. Les lancements suivants le réutilisent depuis le cache.

## Déploiement reproductible avec Docker Compose

```powershell
Copy-Item .env.docker.example .env
# Remplacer VOICEACT_INTERNAL_TOKEN par un secret aléatoire d'au moins 32 caractères.
./scripts/preflight-deploy.ps1
docker compose build
docker compose up -d
docker compose ps
```

L'application écoute sur le port `3100` par défaut. Le service vocal n'est pas publié sur Internet; seul le conteneur Next.js peut le joindre. Les modèles sont conservés dans le volume `speech-models`, donc un redémarrage ou une mise à jour ne déclenche pas un nouveau téléchargement.

Le port applicatif est lié à `127.0.0.1` par défaut : il n'est pas directement exposé à Internet. Le futur proxy HTTPS public devra être installé sur le même serveur ou la valeur `VOICEACT_BIND_ADDRESS` devra être changée consciemment. Les journaux sont limités à trois fichiers de 10 Mo par service afin qu'une erreur répétée ne remplisse pas le disque.

## Profil matériel de départ

Le profil livré est volontairement CPU : `small`, `cpu`, `int8`, une analyse concurrente. Il fonctionne sur une VM sans GPU et ne lie pas le produit à NVIDIA.

Minimum raisonnable pour la bêta :

- 4 vCPU;
- 8 Go de RAM;
- 20 Go de stockage persistant;
- une file applicative ou une seule analyse simultanée par instance.

Pour plus de précision, passer à `medium` après mesure réelle de la latence. Pour plus de trafic, augmenter d'abord le nombre d'instances du service vocal et placer les tâches dans une file; ne pas augmenter aveuglément `VOICEACT_MAX_CONCURRENCY`, car chaque inférence consomme beaucoup de mémoire.

### Mesure locale de contrôle

Le 15 juillet 2026, une transcription réelle de la vidéo de référence de 46,53 secondes a produit 176 mots horodatés avec le modèle `tiny`. Après mise en cache et maintien du modèle en mémoire, un second passage a pris 5,72 secondes sur la machine de développement CPU. Ce résultat valide la chaîne technique et l'intérêt du préchargement; il ne valide pas la précision pédagogique de `tiny`. Le produit reste configuré sur `small` et devra comparer `small` puis `medium` au corpus annoté avant de figer le modèle de production.

Le 16 juillet 2026, l'image Linux standalone `voiceact-app` a été construite réellement avec Docker 29.6.1 et Compose 5.3.0. Sa taille finale est de 376 Mo. Un test hybride de préproduction — Next.js dans le conteneur, moteur Python réel sur l'hôte — a traité un WAV de 10,39 secondes en 5,96 secondes aller-retour et renvoyé 23 mots horodatés sans OpenAI. L'image WhisperX complète n'a pas été construite sur cette machine, car le disque C ne disposait plus que de 0,83 Go; le préflight exige donc 20 Go avant un build complet.

## Démarrage, santé et dégradation contrôlée

- `speech:/health/live` confirme que le processus répond;
- `speech:/health/ready` confirme que le modèle n'a pas échoué au chargement;
- `app:/api/health` vérifie que l'application peut réellement joindre le moteur choisi;
- Compose attend la santé du moteur avant de démarrer l'application;
- si WhisperX échoue en mode `whisperx`, l'analyse continue avec les timestamps `faster-whisper`;
- en mode `required`, une panne WhisperX fait échouer l'analyse au lieu de fournir une précision inférieure en silence.

Avec `VOICEACT_PRELOAD_MODEL=true`, le service précharge aussi le modèle d'alignement français de WhisperX. La période de démarrage Docker autorise jusqu'à 30 minutes au tout premier déploiement, car le téléchargement dépend du débit du Hub. Les déploiements suivants réutilisent le volume et ne doivent plus payer ce coût.

## Mise en ligne sans rupture

1. Construire une image versionnée, par exemple `voiceact-app:0.1.0` et `voiceact-speech:0.1.0`.
2. Lancer les tests et appeler les deux endpoints de santé.
3. Précharger le modèle avec `VOICEACT_PRELOAD_MODEL=true` avant d'envoyer du trafic.
4. Conserver le volume de modèles entre versions.
5. Déployer la nouvelle version à côté de l'ancienne, vérifier une transcription témoin, puis basculer le proxy.
6. Garder l'image précédente pour un retour arrière immédiat. Ne jamais supprimer le volume pendant un simple rollback.

`VOICEACT_RELEASE` donne automatiquement la même étiquette immuable aux deux images Compose. Pour revenir à la version précédente, remettre sa valeur dans `.env`, exécuter `docker compose up -d --no-build`, puis vérifier `/api/health`. N'utilisez pas `latest` en production.

Le proxy HTTPS (Caddy, Traefik, Nginx ou celui de l'hébergeur) doit accepter au moins 24 Mo, maintenir une requête pendant 120 secondes et transmettre `X-Forwarded-Proto`. Les audios ne sont ni journalisés ni conservés par le service : chaque fichier temporaire est supprimé dans un bloc `finally`, y compris en cas d'erreur.

## Choix d'hébergement

Ce paquet peut être hébergé sur n'importe quelle VM Linux qui accepte Docker et un volume persistant. Les plateformes purement serverless sont peu adaptées au moteur vocal : démarrages à froid, limites de durée et absence de cache modèle durable. Pour le MVP, une VM CPU est plus prévisible. Une machine GPU pourra être ajoutée plus tard uniquement au service `speech`, sans reconstruire le produit.

## Vérifications avant chaque release

```powershell
npm run lint
npm run test:engine
npm run build
speech-service\.venv\Scripts\python -m pytest speech-service\tests
docker compose config
docker compose build
```

La dernière ligne doit être exécutée dans un environnement disposant de Docker. Un test réel doit enregistrer un audio français, vérifier que `words` contient des timestamps croissants, puis confirmer que la note VoiceAct est produite sans clé OpenAI.
