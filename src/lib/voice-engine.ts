import { clampScore } from "./audio-analysis";
import { buildPronunciationAssessment } from "./pronunciation-engine";
import type {
  AnalysisResult,
  DetailedAudioMetrics,
  Lesson,
  LessonSegment,
  SegmentAnalysis,
  TimestampedTranscription,
  TimedWord,
  VoiceDimensionScores,
  WordAlignment,
} from "./types";

type ExpectedToken = { raw: string; normalized: string; segmentIndex: number };
type ActualToken = TimedWord & { raw: string; normalized: string };

const paceMultipliers: Record<LessonSegment["pace"], number> = {
  slow: 0.82,
  steady: 1,
  fast: 1.18,
  build: 1.08,
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function normalizeParts(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function expectedTokens(lesson: Lesson): ExpectedToken[] {
  return lesson.segments.flatMap((segment, segmentIndex) =>
    normalizeParts(segment.text).map((normalized) => ({ raw: normalized, normalized, segmentIndex })),
  );
}

function actualTokens(words: TimedWord[]): ActualToken[] {
  return words.flatMap((word) =>
    normalizeParts(word.word).map((normalized) => ({ ...word, raw: word.word, normalized })),
  );
}

export function alignTranscriptToLesson(lesson: Lesson, words: TimedWord[]) {
  const expected = expectedTokens(lesson);
  const actual = actualTokens(words);
  const rows = expected.length + 1;
  const columns = actual.length + 1;
  const costs = Array.from({ length: rows }, () => new Uint16Array(columns));

  for (let row = 0; row < rows; row += 1) costs[row][0] = row;
  for (let column = 0; column < columns; column += 1) costs[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = costs[row - 1][column - 1] + (expected[row - 1]?.normalized === actual[column - 1]?.normalized ? 0 : 1);
      const deletion = costs[row - 1][column] + 1;
      const insertion = costs[row][column - 1] + 1;
      costs[row][column] = Math.min(substitution, deletion, insertion);
    }
  }

  const alignment: WordAlignment[] = [];
  let row = expected.length;
  let column = actual.length;
  let matches = 0;
  let substitutions = 0;
  let omissions = 0;
  let insertions = 0;

  while (row > 0 || column > 0) {
    const expectedWord = expected[row - 1];
    const actualWord = actual[column - 1];
    const isMatch = row > 0 && column > 0 && expectedWord.normalized === actualWord.normalized;
    const diagonalCost = row > 0 && column > 0 ? costs[row - 1][column - 1] + (isMatch ? 0 : 1) : Number.POSITIVE_INFINITY;

    if (row > 0 && column > 0 && costs[row][column] === diagonalCost) {
      alignment.push({
        expected: expectedWord.raw,
        actual: actualWord.raw,
        segmentIndex: expectedWord.segmentIndex,
        start: actualWord.start,
        end: actualWord.end,
        status: isMatch ? "matched" : "substituted",
      });
      if (isMatch) matches += 1;
      else substitutions += 1;
      row -= 1;
      column -= 1;
    } else if (row > 0 && costs[row][column] === costs[row - 1][column] + 1) {
      alignment.push({
        expected: expectedWord.raw,
        actual: null,
        segmentIndex: expectedWord.segmentIndex,
        start: null,
        end: null,
        status: "omitted",
      });
      omissions += 1;
      row -= 1;
    } else {
      alignment.push({
        expected: null,
        actual: actualWord.raw,
        segmentIndex: null,
        start: actualWord.start,
        end: actualWord.end,
        status: "inserted",
      });
      insertions += 1;
      column -= 1;
    }
  }

  alignment.reverse();
  const wordAccuracy = expected.length
    ? Math.max(0, 1 - (substitutions + omissions + insertions) / expected.length)
    : 0;

  return { alignment, matches, substitutions, omissions, insertions, expectedCount: expected.length, wordAccuracy };
}

function scoreDistance(actual: number, target: number, toleranceRatio: number) {
  const tolerance = Math.max(1, target * toleranceRatio);
  return clampScore(100 - (Math.abs(actual - target) / tolerance) * 45);
}

function segmentTargetWpm(lesson: Lesson, segment: LessonSegment) {
  return Math.round(lesson.targetWpm * paceMultipliers[segment.pace]);
}

function energyScore(segment: LessonSegment, segmentDbfs: number, recordingMedianDbfs: number, variation: number) {
  const relativeDb = segmentDbfs - recordingMedianDbfs;
  const targets: Record<LessonSegment["energy"], { min: number; max: number }> = {
    low: { min: -8, max: -1.5 },
    contained: { min: -5, max: 0.5 },
    medium: { min: -2.5, max: 2.5 },
    high: { min: 1.5, max: 8 },
  };
  const target = targets[segment.energy];
  const distance = relativeDb < target.min ? target.min - relativeDb : relativeDb > target.max ? relativeDb - target.max : 0;
  const containmentPenalty = segment.energy === "contained" && variation > 0.55 ? (variation - 0.55) * 55 : 0;
  return clampScore(100 - distance * 11 - containmentPenalty);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function intonationScore(segment: LessonSegment, pitchValues: number[]) {
  if (pitchValues.length < 6) return null;
  const baseline = median(pitchValues);
  const semitones = pitchValues.map((pitch) => 12 * Math.log2(pitch / baseline));
  const third = Math.max(1, Math.floor(semitones.length / 3));
  const start = median(semitones.slice(0, third));
  const middle = median(semitones.slice(third, third * 2));
  const end = median(semitones.slice(third * 2));
  const slope = end - start;
  const range = Math.max(...semitones) - Math.min(...semitones);

  switch (segment.intonation) {
    case "low_flat":
      return clampScore(100 - Math.abs(slope) * 18 - Math.max(0, range - 3) * 12);
    case "low_rise":
      return scoreDistance(slope, 1.8, 1.1);
    case "rise":
      return scoreDistance(slope, 3.2, 0.8);
    case "fall":
      return scoreDistance(slope, -3.2, 0.8);
    case "rise_fall": {
      const rise = middle - start;
      const fall = middle - end;
      return clampScore((scoreDistance(rise, 2.4, 0.9) + scoreDistance(fall, 2.4, 0.9)) / 2);
    }
    case "build":
      return clampScore(scoreDistance(slope, 3, 0.9) - (middle < start ? 20 : 0));
  }
}

function buildSegmentFeedback(segment: LessonSegment, analysis: Omit<SegmentAnalysis, "feedback">) {
  const scored = [
    { key: "diction", score: analysis.dictionScore },
    { key: "pace", score: analysis.paceScore ?? 100 },
    { key: "pause", score: analysis.pauseScore ?? 100 },
    { key: "energy", score: analysis.energyScore ?? 100 },
    { key: "intonation", score: analysis.intonationScore ?? 100 },
  ].sort((a, b) => a.score - b.score);

  switch (scored[0]?.key) {
    case "diction":
      return "Reprends cette phrase en articulant chaque mot sans accélérer.";
    case "pace":
      return analysis.detectedWpm && analysis.detectedWpm > analysis.targetWpm
        ? "Ralentis légèrement cette phrase sans casser son intention."
        : "Donne davantage d’élan à cette phrase.";
    case "pause":
      return "Laisse le silence indiqué se terminer avant d’attaquer la phrase suivante.";
    case "energy":
      return `Ajuste l’intensité : cette phrase demande une énergie ${segment.energy}.`;
    case "intonation":
      return `Rejoue la courbe ${segment.intonation} sans forcer ta hauteur naturelle.`;
    default:
      return "La phrase respecte la direction principale.";
  }
}

function scoreTechnical(metrics: DetailedAudioMetrics) {
  const clippingScore = clampScore(100 - Math.max(0, metrics.clippingRatio - 0.0005) * 12_000);
  const signalToNoise = metrics.medianSpeechDbfs - metrics.noiseFloorDbfs;
  const noiseScore = clampScore(45 + signalToNoise * 3.5);
  const voicedScore = clampScore(45 + metrics.voicedRatio * 70);
  return clampScore(clippingScore * 0.4 + noiseScore * 0.35 + voicedScore * 0.25);
}

function dimensionAdvice(dimensions: VoiceDimensionScores) {
  const weakest = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0]?.[0];
  switch (weakest) {
    case "clarity":
      return "Priorité : refais la prise en visant les mots omis ou remplacés, avec une articulation plus nette.";
    case "rhythm":
      return "Priorité : suis le passage des phrases sur la barre et respecte les silences programmés.";
    case "intonation":
      return "Priorité : reproduis la direction de la courbe, relativement à ta propre voix, sans chercher une hauteur absolue.";
    case "expressiveness":
      return "Priorité : fais varier l’énergie entre les intentions au lieu de garder le même volume partout.";
    default:
      return "Priorité : rapproche-toi du micro, évite la saturation et enregistre dans un environnement plus calme.";
  }
}

export function transcriptionModelCanValidate(transcription: TimestampedTranscription) {
  if (transcription.provider === "openai") return true;
  const model = transcription.model.toLocaleLowerCase("en-US");
  return !/(^|[-_/])(tiny|base)(?:[-_/]|$)/u.test(model);
}

export function buildVoiceAnalysis(
  lesson: Lesson,
  metrics: DetailedAudioMetrics,
  transcription: TimestampedTranscription | null,
  transcriptionError?: string | null,
): AnalysisResult {
  const expectedPauseCount = Math.max(0, lesson.segments.length - 1);
  const technicalScore = scoreTechnical(metrics);
  const pitchCoverage = Math.min(1, metrics.voicedRatio);
  const acousticCanValidate = metrics.acousticSource === "praat-parselmouth" && metrics.acousticQuality === "high";
  const rmsPercent = Math.round(metrics.rms * 100);
  const energyVariationPercent = Math.round(metrics.energyVariation * 100);

  if (!transcription?.words.length) {
    const reason = transcriptionError?.trim();
    const looksLikeSilence = metrics.duration < 0.75
      || metrics.speechRatio < 0.08
      || metrics.voicedRatio < 0.04
      || /aucune parole|parole suffisamment claire|no speech|silence|audio vide/iu.test(reason ?? "");

    return {
      analysisStatus: looksLikeSilence ? "no-speech" : "analysis-unavailable",
      globalScore: 0,
      wpm: 0,
      targetWpm: lesson.targetWpm,
      pauseCount: metrics.pauseCount,
      expectedPauses: expectedPauseCount,
      silencePercent: Math.round(metrics.silenceRatio * 100),
      rmsPercent,
      peakPercent: Math.round(metrics.peak * 100),
      energyVariationPercent,
      badge: "",
      advice: looksLikeSilence
        ? "Rapproche-toi du micro et parle dès que la première phrase touche la ligne rouge."
        : reason || "Le moteur vocal n'est pas prêt. Aucun score n'a été créé pour cette prise.",
      nextGoal: "Aucun score n’a été créé pour cette prise.",
      xpEarned: 0,
      analysisMode: "local-only",
      confidence: 0,
      canValidate: false,
      failureReason: reason,
      acousticSource: metrics.acousticSource,
      acousticQuality: metrics.acousticQuality,
      intensityRangeDb: metrics.intensityRangeDb,
      hnrMeanDb: metrics.hnrMeanDb,
      phonemeAlignmentStatus: "unavailable",
      medianPitchHz: metrics.medianPitchHz,
      pitchRangeSemitones: metrics.pitchRangeSemitones,
      clippingPercent: metrics.clippingRatio * 100,
      segmentAnalyses: [],
    };
  }

  const aligned = alignTranscriptToLesson(lesson, transcription.words);
  const pronunciation = buildPronunciationAssessment(transcription.phonemeAlignment, metrics);
  const segmentAnalyses: SegmentAnalysis[] = lesson.segments.map((segment, segmentIndex) => {
    const segmentAlignment = aligned.alignment.filter((item) => item.segmentIndex === segmentIndex);
    const timed = segmentAlignment.filter((item) => item.start !== null && item.end !== null);
    const start = timed.length ? Math.min(...timed.map((item) => item.start as number)) : null;
    const end = timed.length ? Math.max(...timed.map((item) => item.end as number)) : null;
    const spokenWords = timed.length;
    const targetWpm = segmentTargetWpm(lesson, segment);
    const detectedWpm = start !== null && end !== null && end - start >= 0.25
      ? Math.round(spokenWords / ((end - start) / 60))
      : null;
    const nextTimed = aligned.alignment.filter((item) => item.segmentIndex === segmentIndex + 1 && item.start !== null);
    const nextStart = nextTimed.length ? Math.min(...nextTimed.map((item) => item.start as number)) : null;
    const actualPauseAfterMs = end !== null && nextStart !== null ? Math.max(0, (nextStart - end) * 1_000) : null;
    const matched = segmentAlignment.filter((item) => item.status === "matched").length;
    const expected = segmentAlignment.filter((item) => item.expected !== null).length;
    const lexicalDictionScore = clampScore(((matched + (spokenWords - matched) * 0.15) / Math.max(1, expected)) * 100);
    const segmentPhoneScores = start === null || end === null
      ? []
      : pronunciation.phones
          .filter((phone) => phone.score !== null && phone.start >= start - 0.04 && phone.end <= end + 0.04)
          .map((phone) => phone.score as number);
    const dictionScore = segmentPhoneScores.length
      ? clampScore(lexicalDictionScore * 0.55 + average(segmentPhoneScores) * 0.45)
      : lexicalDictionScore;
    const paceScore = detectedWpm === null ? null : scoreDistance(detectedWpm, targetWpm, 0.25);
    const pauseScore = segmentIndex === lesson.segments.length - 1 || actualPauseAfterMs === null
      ? null
      : scoreDistance(actualPauseAfterMs, segment.pauseAfterMs, 0.45);
    const acousticFrames = start === null || end === null
      ? []
      : metrics.frames.filter((frame) => frame.isSpeech && frame.start >= start && frame.end <= end + 0.04);
    const segmentDbfs = median(acousticFrames.map((frame) => frame.dbfs));
    const segmentRmsMean = average(acousticFrames.map((frame) => frame.rms));
    const segmentVariation = segmentRmsMean > 0
      ? Math.sqrt(average(acousticFrames.map((frame) => (frame.rms - segmentRmsMean) ** 2))) / segmentRmsMean
      : 0;
    const measuredEnergyScore = acousticFrames.length
      ? energyScore(segment, segmentDbfs, metrics.medianSpeechDbfs, segmentVariation)
      : null;
    const pitchValues = acousticFrames
      .filter((frame) => frame.pitchHz !== null && frame.pitchConfidence >= 0.58)
      .map((frame) => frame.pitchHz as number);
    const measuredIntonationScore = intonationScore(segment, pitchValues);
    const withoutFeedback: Omit<SegmentAnalysis, "feedback"> = {
      segmentIndex,
      text: segment.text,
      start,
      end,
      detectedWpm,
      targetWpm,
      actualPauseAfterMs,
      targetPauseAfterMs: segment.pauseAfterMs,
      dictionScore,
      paceScore,
      pauseScore,
      energyScore: measuredEnergyScore,
      intonationScore: measuredIntonationScore,
    };
    return { ...withoutFeedback, feedback: buildSegmentFeedback(segment, withoutFeedback) };
  });

  const validPace = segmentAnalyses.flatMap((segment) => segment.paceScore === null ? [] : [segment.paceScore]);
  const validPauses = segmentAnalyses.flatMap((segment) => segment.pauseScore === null ? [] : [segment.pauseScore]);
  const validEnergy = segmentAnalyses.flatMap((segment) => segment.energyScore === null ? [] : [segment.energyScore]);
  const validIntonation = segmentAnalyses.flatMap((segment) => segment.intonationScore === null ? [] : [segment.intonationScore]);
  const lexicalClarity = clampScore(aligned.wordAccuracy * 100);
  const clarity = pronunciation.score === null
    ? lexicalClarity
    : clampScore(lexicalClarity * 0.55 + pronunciation.score * 0.45);
  const rhythm = clampScore(average([...validPace, ...validPauses]));
  const intonation = validIntonation.length ? clampScore(average(validIntonation)) : 45;
  const expressiveness = validEnergy.length ? clampScore(average(validEnergy)) : 45;
  const dimensions: VoiceDimensionScores = { clarity, rhythm, intonation, expressiveness, technical: technicalScore };
  const globalScore = clampScore(clarity * 0.3 + rhythm * 0.25 + intonation * 0.18 + expressiveness * 0.17 + technicalScore * 0.1);
  const firstWord = transcription.words[0];
  const lastWord = transcription.words.at(-1);
  const speakingSpan = firstWord && lastWord ? Math.max(0.2, lastWord.end - firstWord.start) : metrics.duration;
  const wpm = Math.round(transcription.words.length / (speakingSpan / 60));
  const timestampCoverage = aligned.expectedCount ? (aligned.matches + aligned.substitutions) / aligned.expectedCount : 0;
  const confidence = Math.min(0.97, 0.55 + timestampCoverage * 0.24 + pitchCoverage * 0.1 + (technicalScore / 100) * 0.08);
  const modelCanValidate = transcriptionModelCanValidate(transcription);
  const standardCanValidate = modelCanValidate
    && acousticCanValidate
    && confidence >= 0.68
    && aligned.wordAccuracy >= 0.55
    && technicalScore >= 45;
  const canValidate = standardCanValidate;
  const validationReason = !modelCanValidate
    ? `Le modèle ${transcription.model} sert uniquement au test technique. Une analyse small ou supérieure est requise pour valider l'étape.`
    : !acousticCanValidate
      ? "La mesure prosodique Praat est absente ou trop limitée. La prise reste informative et ne débloque pas l'étape."
      : !pronunciation.canValidate
        ? "Analyse standard active : rythme, texte, volume et intonation sont notés. La précision phonétique avancée attend MFA."
        : undefined;
  const weakestSegment = [...segmentAnalyses].sort((a, b) => {
    const scoreA = average([a.dictionScore, a.paceScore ?? 100, a.pauseScore ?? 100, a.energyScore ?? 100, a.intonationScore ?? 100]);
    const scoreB = average([b.dictionScore, b.paceScore ?? 100, b.pauseScore ?? 100, b.energyScore ?? 100, b.intonationScore ?? 100]);
    return scoreA - scoreB;
  })[0];
  const badge = canValidate
    ? globalScore >= 85
      ? `${lesson.emotion} maîtrisée`
      : globalScore >= 70
        ? "Intention convaincante"
        : "Base mesurée"
    : "";

  return {
    analysisStatus: "scored",
    globalScore,
    wpm,
    targetWpm: lesson.targetWpm,
    pauseCount: metrics.pauseCount,
    expectedPauses: expectedPauseCount,
    silencePercent: Math.round(metrics.silenceRatio * 100),
    rmsPercent,
    peakPercent: Math.round(metrics.peak * 100),
    energyVariationPercent,
    badge,
    // A learner gets one actionable coach cue.  The detailed evidence remains
    // available in `pronunciation` and `segmentAnalyses`, without overloading
    // the first feedback screen.
    advice: validationReason ?? pronunciation.priority ?? dimensionAdvice(dimensions) ?? weakestSegment?.feedback ?? "Refais une prise complète.",
    nextGoal: weakestSegment ? `Rejoue d’abord : « ${weakestSegment.text} »` : "Refais une prise complète.",
    xpEarned: canValidate ? (globalScore >= 80 ? lesson.xp : Math.max(5, Math.round(lesson.xp * 0.45))) : 0,
    analysisMode: pronunciation.canValidate ? "full" : "local-only",
    confidence,
    canValidate,
    analysisModel: transcription.model,
    validationReason,
    acousticSource: metrics.acousticSource,
    acousticQuality: metrics.acousticQuality,
    intensityRangeDb: metrics.intensityRangeDb,
    hnrMeanDb: metrics.hnrMeanDb,
    phonemeAlignmentStatus: transcription.phonemeAlignment ? "aligned" : "unavailable",
    phonemeCount: transcription.phonemeAlignment?.phones.length,
    phonemeScoringReason: transcription.phonemeAlignment?.scoringReason ?? transcription.phonemeAlignmentError,
    pronunciation,
    transcript: transcription.text,
    wordAccuracyPercent: Math.round(aligned.wordAccuracy * 100),
    matchedWords: aligned.matches,
    expectedWords: aligned.expectedCount,
    medianPitchHz: metrics.medianPitchHz,
    pitchRangeSemitones: metrics.pitchRangeSemitones,
    clippingPercent: metrics.clippingRatio * 100,
    dimensionScores: dimensions,
    segmentAnalyses,
  };
}
