import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/build-timing-profile.mjs <transcription.json> <profile.json>");
  process.exit(1);
}

const transcription = JSON.parse(readFileSync(inputPath, "utf8"));
const words = Array.isArray(transcription.words) ? transcription.words : [];

if (words.length === 0) {
  throw new Error("La transcription ne contient aucun mot horodaté.");
}

const pauseThresholdSeconds = 0.35;
const groups = [];
let current = [];

for (const word of words) {
  const previous = current.at(-1);
  if (previous && word.start - previous.end >= pauseThresholdSeconds) {
    groups.push(current);
    current = [];
  }
  current.push(word);
}
if (current.length > 0) groups.push(current);

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function summarize(group, index) {
  const start = group[0].start;
  const end = group.at(-1).end;
  const spanSeconds = end - start;
  const articulationSeconds = group.reduce((total, word) => total + (word.end - word.start), 0);
  const internalPausesMs = group.slice(1).map((word, wordIndex) =>
    Math.max(0, Math.round((word.start - group[wordIndex].end) * 1000)),
  );
  const nextGroup = groups[index + 1];

  return {
    index,
    text: group.map((word) => word.word).join(" "),
    start: round(start),
    end: round(end),
    spanMs: Math.round(spanSeconds * 1000),
    articulationMs: Math.round(articulationSeconds * 1000),
    grossWpm: Math.round((group.length / spanSeconds) * 60),
    articulationWpm: Math.round((group.length / articulationSeconds) * 60),
    pauseAfterMs: nextGroup ? Math.round((nextGroup[0].start - end) * 1000) : null,
    internalPausesMs,
    words: group.map((word) => ({
      word: word.word,
      startMs: Math.round((word.start - start) * 1000),
      endMs: Math.round((word.end - start) * 1000),
      confidence: word.confidence == null ? null : round(word.confidence, 3),
    })),
  };
}

const profile = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceTranscription: inputPath,
  provider: transcription.provider,
  model: transcription.model,
  language: transcription.language,
  durationSeconds: transcription.duration,
  pauseThresholdMs: pauseThresholdSeconds * 1000,
  wordCount: words.length,
  groups: groups.map(summarize),
};

writeFileSync(outputPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
console.log(`Profil créé : ${outputPath} (${profile.groups.length} groupes, ${words.length} mots)`);
