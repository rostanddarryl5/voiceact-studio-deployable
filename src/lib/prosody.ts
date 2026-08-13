import type { IntonationShape, LessonSegment } from "./types";

const paceRateMultipliers = {
  slow: 0.9,
  steady: 1,
  fast: 1.1,
  build: 1.05,
} as const;

/**
 * Lightweight French syllable estimate used only to lay out the live prompt.
 * The scoring engine still relies on observed word timestamps. Keeping this
 * estimate here prevents the UI from treating every word as equally long.
 */
export function estimateFrenchSyllables(text: string) {
  const words: string[] = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’']/g, " ")
    .match(/[a-z]+/g) ?? [];

  return Math.max(1, words.reduce((total, word) => {
    const compact = word
      .replace(/(?:ent|es|e)$/u, "")
      .replace(/(?:qu|gu)(?=[eiy])/gu, (match) => match[0] ?? match);
    const vowelGroups = compact.match(/[aeiouy]+/g)?.length ?? 1;
    return total + Math.max(1, vowelGroups);
  }, 0));
}

export function segmentSpeechDurationMs(
  text: string,
  targetWpm: number,
  pace: keyof typeof paceRateMultipliers,
  referenceSpeechDurationMs?: number,
  emphasisCount = 0,
) {
  if (referenceSpeechDurationMs && referenceSpeechDurationMs > 0) {
    return Math.max(450, referenceSpeechDurationMs);
  }

  // French read speech averages roughly 1.45 spoken syllables per written word.
  // We derive a personalisable syllabic rate from the exercise WPM, then apply
  // the local intention instead of compressing the whole sentence uniformly.
  // Punctuation and stressed pivots receive small local holds: accelerating a
  // phrase must not be implemented as uniform time compression.
  const targetSyllablesPerSecond = Math.max(2.4, (targetWpm * 1.45) / 60);
  const localRate = targetSyllablesPerSecond * paceRateMultipliers[pace];
  const punctuationHoldMs = (text.match(/[,;:]/g)?.length ?? 0) * 110
    + (text.match(/(?:â€¦|\.\.\.)/g)?.length ?? 0) * 320;
  const emphasisHoldMs = Math.min(240, emphasisCount * 55);
  return Math.max(780, (estimateFrenchSyllables(text) / localRate) * 1_000 + punctuationHoldMs + emphasisHoldMs);
}

export function resolveSegmentSpeechDurationMs(segment: LessonSegment, targetWpm: number) {
  const alignedDuration = segment.referenceWordTimings?.at(-1)?.endMs;
  return segmentSpeechDurationMs(
    segment.text,
    targetWpm,
    segment.pace,
    segment.referenceSpeechDurationMs ?? alignedDuration,
    segment.emphasis.length,
  );
}

export type PromptWordTiming = {
  word: string;
  startMs: number;
  endMs: number;
  emphasized: boolean;
  accelerated: boolean;
  sizeCue: "soft" | "normal" | "strong";
};

const shortFunctionWords = new Set([
  "a", "au", "aux", "ce", "ces", "de", "des", "du", "en", "et", "il", "je", "la", "le", "les",
  "mais", "ne", "pas", "plus", "que", "qui", "se", "si", "sur", "tu", "un", "une",
]);

function normalizedPromptWord(word: string) {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Builds word anchors for the visual ribbon. Professional timestamps win.
 * Without a reference, the estimate intentionally varies inside a sentence:
 * syllable count, function words, emphasis, punctuation and a build-up contour
 * all affect the interval before the next word reaches the playhead.
 */
export function buildPromptWordTimings(
  segment: LessonSegment,
  targetWpm: number,
  speechDurationMs = resolveSegmentSpeechDurationMs(segment, targetWpm),
): PromptWordTiming[] {
  const emphasis = new Set(segment.emphasis.flatMap((item) => item.split(/\s+/)).map(normalizedPromptWord));
  const accelerated = new Set((segment.accelerateWords ?? []).flatMap((item) => item.split(/\s+/)).map(normalizedPromptWord));
  const louder = new Set((segment.louderWords ?? []).flatMap((item) => item.split(/\s+/)).map(normalizedPromptWord));
  const softer = new Set((segment.softerWords ?? []).flatMap((item) => item.split(/\s+/)).map(normalizedPromptWord));

  const wordCues = (word: string) => {
    const normalized = normalizedPromptWord(word);
    return {
      emphasized: emphasis.has(normalized),
      accelerated: accelerated.has(normalized),
      sizeCue: louder.has(normalized) ? "strong" as const : softer.has(normalized) ? "soft" as const : "normal" as const,
    };
  };

  if (segment.referenceWordTimings?.length) {
    return segment.referenceWordTimings.map((timing) => ({
      ...timing,
      ...wordCues(timing.word),
    }));
  }

  const words = segment.text.match(/\S+/g) ?? [];
  if (words.length === 0) return [];

  const weights = words.map((word, index) => {
    const normalized = normalizedPromptWord(word);
    const syllables = estimateFrenchSyllables(word);
    const isEmphasized = emphasis.has(normalized);
    const isAccelerated = accelerated.has(normalized);
    const isFunctionWord = shortFunctionWords.has(normalized);
    const progress = words.length <= 1 ? 0 : index / (words.length - 1);
    const punctuationHold = /(?:â€¦|\.\.\.)$/.test(word) ? 1.2 : /[,;:]$/.test(word) ? 0.55 : /[.!?]$/.test(word) ? 0.3 : 0;
    const buildShape = segment.pace === "build" ? 1.14 - progress * 0.26 : 1;
    const paceShape = segment.pace === "fast" && isFunctionWord ? 0.74 : segment.pace === "slow" && isEmphasized ? 1.18 : 1;
    const accentShape = isEmphasized ? 1.24 : isFunctionWord ? 0.84 : 1;
    const accelerationShape = isAccelerated ? 0.66 : 1;
    return Math.max(0.38, (syllables + punctuationHold) * buildShape * paceShape * accentShape * accelerationShape);
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return words.map((word, index) => {
    const duration = index === words.length - 1
      ? Math.max(80, speechDurationMs - cursor)
      : (weights[index] / totalWeight) * speechDurationMs;
    const timing = {
      word,
      startMs: cursor,
      endMs: cursor + duration,
      ...wordCues(word),
    };
    cursor += duration;
    return timing;
  });
}

export function prompterMotionPixelsPerMs(targetWpm: number, segments: LessonSegment[]) {
  const averagePaceMultiplier = segments.length === 0
    ? 1
    : segments.reduce((sum, segment) => sum + paceRateMultipliers[segment.pace], 0) / segments.length;
  const effectiveWpm = targetWpm * averagePaceMultiplier;
  // The time geometry remains exact (width = duration × speed), while the
  // perceived motion becomes deliberately slower for restraint and faster for
  // urgency. Range: 74–118 px/s, comfortable on phone and desktop.
  const pixelsPerSecond = Math.max(74, Math.min(118, 74 + (effectiveWpm - 80) * 0.39));
  return pixelsPerSecond / 1_000;
}

export function prompterRateLabel(targetWpm: number, segments: LessonSegment[]) {
  const pixelsPerSecond = prompterMotionPixelsPerMs(targetWpm, segments) * 1_000;
  if (pixelsPerSecond < 82) return "Rythme retenu";
  if (pixelsPerSecond < 98) return "Rythme posé";
  if (pixelsPerSecond < 110) return "Rythme dynamique";
  return "Rythme vif";
}

export function pauseLabel(ms: number) {
  if (ms >= 900) return "Pause longue";
  if (ms >= 500) return "Pause moyenne";
  return "Pause courte";
}

export function intonationLabel(shape: IntonationShape) {
  const labels: Record<IntonationShape, string> = {
    low_flat: "bas stable",
    low_rise: "bas puis montee",
    rise: "montee",
    fall: "descente",
    rise_fall: "montee puis chute",
    build: "montee progressive",
  };
  return labels[shape];
}

export function curvePath(shape: IntonationShape) {
  const paths: Record<IntonationShape, string> = {
    low_flat: "M8 48 C28 48 44 48 64 48 C84 48 100 48 120 48",
    low_rise: "M8 52 C32 52 46 48 64 42 C86 34 101 30 120 28",
    rise: "M8 56 C34 52 52 42 72 30 C92 18 106 14 120 12",
    fall: "M8 18 C30 20 46 28 66 38 C88 50 104 56 120 58",
    rise_fall: "M8 50 C30 42 44 18 64 18 C86 18 98 44 120 54",
    build: "M8 56 C28 54 40 48 56 42 C76 34 90 24 120 14",
  };
  return paths[shape];
}
