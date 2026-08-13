import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_SERVER_URL = "http://127.0.0.1:3100";
const DEFAULT_OUTPUT_DIR = path.resolve("output", "review-pending");

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function wordSimilarity(expected, actual) {
  const left = normalizeText(expected).split(" ").filter(Boolean);
  const right = normalizeText(actual).split(" ").filter(Boolean);
  if (!left.length || !right.length) return 0;

  const distances = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) distances[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }
  const maxLength = Math.max(left.length, right.length);
  return Math.max(0, 1 - distances[left.length][right.length] / maxLength);
}

function readWavDuration(buffer) {
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WAVE") {
    return null;
  }

  let offset = 12;
  let byteRate = null;
  let dataBytes = null;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "fmt " && chunkStart + 16 <= buffer.length) {
      byteRate = buffer.readUInt32LE(chunkStart + 8);
    }
    if (chunkId === "data") {
      dataBytes = chunkSize;
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  return byteRate && dataBytes ? dataBytes / byteRate : null;
}

async function getScript(scriptId) {
  const compiledPath = path.resolve(".tmp-exercise-model-test", "data", "tts-reference-corpus.js");
  try {
    const corpus = await import(`file:///${compiledPath.replace(/\\/g, "/")}`);
    const script = corpus.getTtsScriptById(scriptId);
    if (!script) throw new Error(`Script inconnu: ${scriptId}`);
    return script;
  } catch (error) {
    throw new Error(
      `Corpus compile introuvable ou invalide. Lance d'abord "npm run test:exercise-model". Detail: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function postTranscription({ serverUrl, speechUrl, audioPath, expectedText, token }) {
  const audio = await fs.readFile(audioPath);
  const body = new FormData();
  body.append("audio", new Blob([audio], { type: "audio/wav" }), path.basename(audioPath));
  body.append(speechUrl ? "expected_text" : "expectedText", expectedText);

  const endpoint = speechUrl
    ? `${speechUrl.replace(/\/$/, "")}/v1/transcriptions?language=fr`
    : `${serverUrl.replace(/\/$/, "")}/api/voice-analysis/transcribe`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: token ? { "X-VoiceAct-Internal-Token": token } : undefined,
    body,
    signal: AbortSignal.timeout(180_000),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data?.error?.code ?? "TRANSCRIPTION_FAILED";
    const message = data?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${code}: ${message}`);
  }
  return data;
}

function acousticSummary(transcription) {
  const acoustics = transcription.acoustics;
  if (!acoustics) return null;
  return {
    source: acoustics.source,
    quality: acoustics.quality,
    pitchMedianHz: acoustics.pitchMedianHz,
    pitchRangeSemitones: acoustics.pitchRangeSemitones,
    intensityMeanDb: acoustics.intensityMeanDb,
    intensityRangeDb: acoustics.intensityRangeDb,
    voicedRatio: acoustics.voicedRatio,
  };
}

function mfaSummary(transcription) {
  const mfa = transcription.phonemeAlignment;
  if (!mfa) {
    return {
      status: "missing",
      error: transcription.phonemeAlignmentError ?? "Aucun alignement phonemique MFA retourne.",
      wordTimingsReadyForPreview: Array.isArray(transcription.words) && transcription.words.length > 0,
      phonemeTimingsReady: false,
      confidenceCoverage: 0,
      canScorePronunciation: false,
    };
  }
  return {
    status: mfa.status === "aligned" ? "approved" : "limited",
    model: mfa.model,
    file: null,
    wordTimingsReadyForPreview: Array.isArray(mfa.words) && mfa.words.length > 0,
    phonemeTimingsReady: Array.isArray(mfa.phones) && mfa.phones.length > 0,
    scoreKind: mfa.scoreKind,
    confidenceCoverage: mfa.confidenceCoverage ?? 0,
    canScorePronunciation: mfa.canScorePronunciation === true,
  };
}

async function main() {
  const scriptId = argValue("--script-id");
  const audioPathArg = argValue("--audio");
  const serverUrl = argValue("--server", DEFAULT_SERVER_URL);
  const speechUrl = argValue("--speech-url");
  const token = argValue("--token");
  const humanApproved = argValue("--human-approved", "false") === "true";
  if (!scriptId) throw new Error("Parametre requis: --script-id=<id>");
  if (!audioPathArg) throw new Error("Parametre requis: --audio=<fichier.wav>");

  const script = await getScript(scriptId);
  const audioPath = path.resolve(audioPathArg);
  const audioBuffer = await fs.readFile(audioPath);
  const durationSeconds = readWavDuration(audioBuffer);
  const expectedText = script.beats.map((beat) => beat.text).join(" ");
  const baseName = path.basename(audioPath, path.extname(audioPath));

  const transcription = await postTranscription({ serverUrl, speechUrl, audioPath, expectedText, token });
  const similarity = wordSimilarity(expectedText, transcription.text ?? "");
  const transcriptAccepted = similarity >= 0.92;
  const durationAccepted = durationSeconds !== null
    && durationSeconds >= script.targetDurationSeconds[0]
    && durationSeconds <= script.targetDurationSeconds[1];
  const mfa = mfaSummary(transcription);
  const acoustics = acousticSummary(transcription);
  const publishable = Boolean(
    humanApproved
      && durationAccepted
      && transcriptAccepted
      && mfa.phonemeTimingsReady
      && mfa.canScorePronunciation
      && mfa.confidenceCoverage >= 0.8
      && acoustics?.quality === "high",
  );

  await fs.mkdir(DEFAULT_OUTPUT_DIR, { recursive: true });
  const transcriptionPath = path.join(DEFAULT_OUTPUT_DIR, `${baseName}.transcription.json`);
  const mfaPath = path.join(DEFAULT_OUTPUT_DIR, `${baseName}.mfa-analysis.json`);
  const reviewPath = path.join(DEFAULT_OUTPUT_DIR, `${baseName}.review.json`);

  await fs.writeFile(transcriptionPath, JSON.stringify(transcription, null, 2));
  if (transcription.phonemeAlignment) {
    await fs.writeFile(mfaPath, JSON.stringify(transcription.phonemeAlignment, null, 2));
    mfa.file = path.basename(mfaPath);
  }

  const review = {
    version: 1,
    scriptId,
    title: script.title,
    audio: {
      file: path.basename(audioPath),
      durationSeconds,
      durationContractSeconds: script.targetDurationSeconds,
      approvedByHuman: humanApproved,
      approvedAt: humanApproved ? new Date().toISOString() : null,
    },
    transcription: {
      file: path.basename(transcriptionPath),
      provider: transcription.provider,
      model: transcription.model,
      alignment: transcription.alignment,
      wordCount: Array.isArray(transcription.words) ? transcription.words.length : 0,
      similarity,
      exactTranscriptMatch: transcriptAccepted,
      expectedText,
      actualText: transcription.text ?? "",
    },
    acoustics,
    mfa,
    checklist: {
      durationInContract: durationAccepted ? "pass" : "fail",
      noArtifacts: humanApproved ? "human_approved" : "pending_human_review",
      intentionMatchesDirectorNotes: humanApproved ? "human_approved" : "pending_human_review",
      exactTranscript: transcriptAccepted ? "pass" : "fail",
      mfaWordAlignment: mfa.wordTimingsReadyForPreview ? "pass" : "fail",
      mfaPhoneAlignment: mfa.phonemeTimingsReady ? "pass" : "fail",
      phoneGoodnessCoverage: mfa.confidenceCoverage >= 0.8 ? "pass" : "fail",
      publishable,
    },
    publication: {
      status: publishable ? "approved" : "blocked",
      canPlayExample: publishable,
      canValidateProgress: publishable,
      blockers: [
        !humanApproved && "ecoute humaine non validee",
        !durationAccepted && "duree hors contrat",
        !transcriptAccepted && "transcription trop eloignee du script",
        !mfa.phonemeTimingsReady && "alignement phonemique MFA absent",
        !mfa.canScorePronunciation && "MFA ne fournit pas encore de score phonemique",
        mfa.confidenceCoverage < 0.8 && "couverture phone-goodness insuffisante",
        acoustics?.quality !== "high" && "analyse acoustique incomplete",
      ].filter(Boolean),
    },
  };

  await fs.writeFile(reviewPath, JSON.stringify(review, null, 2));
  console.log(JSON.stringify({
    status: publishable ? "approved" : "blocked",
    reviewPath,
    transcriptionPath,
    mfaPath: transcription.phonemeAlignment ? mfaPath : null,
    similarity,
    durationSeconds,
    blockers: review.publication.blockers,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
