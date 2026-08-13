import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_SERVER_URL = "http://127.0.0.1:3110";
const OUTPUT_DIR = path.resolve("output", "review-pending");
const ARCHIVE_DIR = path.join(OUTPUT_DIR, "archive");

const batches = {
  "creator-short-pilot": [
    { scriptId: "short-01-anomalie", voice: "Sadachbia", family: "feminine" },
    { scriptId: "short-02-fausse-evidence", voice: "Sadachbia", family: "masculine" },
    { scriptId: "short-02-fausse-evidence", voice: "Puck", family: "feminine" },
    { scriptId: "short-03-compte-a-rebours", voice: "Puck", family: "masculine" },
  ],
  "creator-long-pilot": [
    { scriptId: "long-01-carte-ulysse", voice: "Sulafat", family: "masculine" },
    { scriptId: "long-01-carte-ulysse", voice: "Gacrux", family: "feminine" },
  ],
  "dubbing-film-pilot": [
    { scriptId: "film-01-menace-calme", voice: "Schedar", family: "masculine" },
    { scriptId: "film-01-menace-calme", voice: "Kore", family: "feminine" },
  ],
  "dubbing-film-next": [
    { scriptId: "film-02-absence", voice: "Achernar", family: "feminine" },
    { scriptId: "film-02-absence", voice: "Sulafat", family: "masculine" },
    { scriptId: "film-03-alibi", voice: "Orus", family: "masculine" },
  ],
  "creator-news-pilot": [
    { scriptId: "news-01-fait-local", voice: "Charon", family: "masculine" },
    { scriptId: "news-02-hierarchie", voice: "Rasalgethi", family: "feminine" },
  ],
  "creator-horror-pilot": [
    { scriptId: "horror-01-couloir", voice: "Enceladus", family: "masculine" },
    { scriptId: "horror-02-message", voice: "Achernar", family: "feminine" },
  ],
  "creator-ugc-pilot": [
    { scriptId: "ugc-01-test-honnete", voice: "Achird", family: "masculine" },
    { scriptId: "ugc-02-objection", voice: "Zubenelgenubi", family: "feminine" },
  ],
  "dubbing-animation-pilot": [
    { scriptId: "anim-01-luciole", voice: "Leda", family: "feminine" },
    { scriptId: "anim-02-potion", voice: "Fenrir", family: "masculine" },
  ],
  "dubbing-game-pilot": [
    { scriptId: "game-01-trois-variantes", voice: "Kore", family: "feminine" },
    { scriptId: "game-02-impact-sur", voice: "Alnilam", family: "masculine" },
  ],
};

function readDotEnv() {
  return fs.readFile(".env", "utf8")
    .then((content) => Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    ))
    .catch(() => ({}));
}

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function argFlag(name) {
  return process.argv.includes(name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFilePart(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function archiveExistingCandidate(baseName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  for (const suffix of [".wav", ".review.json", ".transcription.json", ".mfa-analysis.json"]) {
    const candidate = path.join(OUTPUT_DIR, `${baseName}${suffix}`);
    try {
      await fs.rename(candidate, path.join(ARCHIVE_DIR, `${baseName}.${stamp}${suffix}`));
    } catch {
      // Missing sidecar files are expected for partially reviewed candidates.
    }
  }
}

async function requestReference({ serverUrl, token, scriptId, voice }) {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/admin/tts-reference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-voiceact-admin-token": token,
    },
    body: JSON.stringify({ scriptId, voice }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    const code = body?.error?.code ?? "UNKNOWN";
    throw new Error(`${code}: ${message}`);
  }

  return {
    wav: new Uint8Array(await response.arrayBuffer()),
    model: response.headers.get("x-voiceact-tts-model") ?? "unknown",
    attempts: Number(response.headers.get("x-voiceact-tts-attempts") ?? 1),
    durationSeconds: Number(response.headers.get("x-voiceact-tts-duration") ?? 0),
  };
}

async function main() {
  const env = await readDotEnv();
  const token = env.VOICEACT_INTERNAL_TOKEN || process.env.VOICEACT_INTERNAL_TOKEN;
  if (!token) throw new Error("VOICEACT_INTERNAL_TOKEN introuvable dans .env.");

  const batchId = argValue("--batch", "creator-short-pilot");
  const serverUrl = argValue("--server", DEFAULT_SERVER_URL);
  const limit = Number(argValue("--limit", String(batches[batchId]?.length ?? 0)));
  const delayMs = Number(argValue("--delay-ms", "8000"));
  const force = argFlag("--force");
  const only = new Set((argValue("--only", "") || "").split(",").map((item) => item.trim()).filter(Boolean));
  const batchJobs = only.size
    ? batches[batchId]?.filter((job) => only.has(job.scriptId))
    : batches[batchId];
  const jobs = batchJobs?.slice(0, Number.isFinite(limit) && limit > 0 ? limit : undefined);
  if (!jobs?.length) throw new Error(`Lot inconnu ou vide: ${batchId}`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const results = [];

  for (const job of jobs) {
    const baseName = `${safeFilePart(job.scriptId)}-${safeFilePart(job.voice)}-${job.family}`;
    const wavPath = path.join(OUTPUT_DIR, `${baseName}.wav`);
    const reviewPath = path.join(OUTPUT_DIR, `${baseName}.review.json`);
    if (!force) {
      try {
        await fs.access(wavPath);
        results.push({ ...job, status: "skipped_existing", wavPath, reviewPath });
        continue;
      } catch {
        // Generate only when the candidate is not already present.
      }
    }

    try {
      const generated = await requestReference({ serverUrl, token, ...job });
      if (force) await archiveExistingCandidate(baseName);
      await fs.writeFile(wavPath, generated.wav);
      await fs.writeFile(reviewPath, JSON.stringify({
        scriptId: job.scriptId,
        voice: job.voice,
        requestedVoiceFamily: job.family,
        generatedAt: new Date().toISOString(),
        source: "Gemini TTS",
        model: generated.model,
        attempts: generated.attempts,
        durationSeconds: generated.durationSeconds,
        wavPath,
        status: "needs_human_review",
        checklist: {
          durationInContract: "pending",
          noArtifacts: "pending",
          intentionMatchesDirectorNotes: "pending",
          exactTranscript: "pending",
          mfaWordAlignment: "pending",
          mfaPhoneAlignment: "pending",
          phoneGoodnessCoverage: "pending",
          publishable: false,
        },
      }, null, 2));
      results.push({ ...job, status: "generated", wavPath, reviewPath, bytes: generated.wav.byteLength, durationSeconds: generated.durationSeconds });
      if (delayMs > 0) await sleep(delayMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...job, status: "blocked", error: message });
      if (/quota|rate-limit|retry/i.test(message)) break;
    }
  }

  console.log(JSON.stringify({ batchId, serverUrl, outputDir: OUTPUT_DIR, force, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
