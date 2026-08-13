# VoiceAct Studio

VoiceAct est une application d’entraînement guidé à la voix off et au doublage. Le MVP associe une interface Next.js responsive, un prompteur rythmé et un moteur d’analyse vocale auto-hébergeable.

## Lancement de l’interface

```powershell
npm install
npm run dev
```

L’application locale est disponible sur <http://127.0.0.1:3110> avec le lanceur VoiceAct, ou sur <http://127.0.0.1:3000> avec la commande Next.js standard.

## Moteur vocal

Le moteur Python utilise faster-whisper et, en amélioration optionnelle, WhisperX. La procédure complète de développement, de test et de déploiement se trouve dans [docs/10_SELF_HOSTED_TRANSCRIPTION.md](docs/10_SELF_HOSTED_TRANSCRIPTION.md).

```powershell
cd speech-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-whisperx.txt
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Contrôles qualité

```powershell
npm run lint
npm run test:engine
npm run build
Push-Location speech-service
.venv\Scripts\python -m pytest tests
Pop-Location
```

## Donnees du diagnostic

Le profil, les scores et le cursus sont conserves dans le stockage local du navigateur. Les 30 dernieres prises audio analysees sont conservees dans IndexedDB. La premiere analyse complete du diagnostic devient une baseline immuable : son score sert a construire le cursus, mais ne bloque jamais l'utilisateur sous 70/100.

Le lanceur `LANCER_VOICEACT.cmd` demarre l'interface et le moteur vocal en arriere-plan. `ARRETER_VOICEACT.cmd` ferme uniquement les processus enregistres par ce lanceur.

Le lanceur utilise désormais `faster-whisper-small`, modèle local minimal autorisé à valider une étape. `tiny` reste disponible uniquement pour diagnostiquer le branchement technique et ses résultats sont explicitement non validants. La production devra comparer `small`, `medium` et `large-v3` sur le corpus VoiceAct annoté avant de figer le modèle final.

Le secours OpenAI est désactivé par défaut : l’application n’engage aucun crédit payant tant que cette option n’est pas explicitement activée.
