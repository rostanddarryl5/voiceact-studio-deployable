export type IntonationShape = "low_flat" | "low_rise" | "rise" | "fall" | "rise_fall" | "build";

export type LessonSegment = {
  text: string;
  pauseAfterMs: number;
  /** Durée validée d'une référence audio professionnelle, prioritaire si disponible. */
  referenceSpeechDurationMs?: number;
  /** Timestamps relatifs au segment, issus d'un alignement mot à mot validé. */
  referenceWordTimings?: Array<{
    word: string;
    startMs: number;
    endMs: number;
  }>;
  timingSource?: "professional_reference" | "research_profile";
  pace: "slow" | "steady" | "fast" | "build";
  energy: "low" | "medium" | "high" | "contained";
  intonation: IntonationShape;
  /** Mots à prononcer plus vite : ce sont les seuls affichés en violet. */
  accelerateWords?: string[];
  /** Mots à jouer avec davantage d'intensité, affichés plus grands. */
  louderWords?: string[];
  /** Mots à jouer calmement, affichés plus petits. */
  softerWords?: string[];
  emphasis: string[];
  note: string;
  deliveryCue: string;
};

export type Lesson = {
  id: string;
  world: string;
  title: string;
  domain: string;
  category: "Diagnostic" | "Hook" | "Narration" | "Doublage" | "Emotion" | "Publicite";
  emotion: string;
  scenario: string;
  level: number;
  xp: number;
  targetWpm: number;
  objective: string;
  coachTip: string;
  focusPoints: string[];
  successCriteria: string[];
  referenceAudio?: {
    status: "licensed" | "commission_required" | "research_only";
    title: string;
    localPath?: string;
    sourceUrl?: string;
    license?: string;
    attribution?: string;
    exactText: boolean;
  };
  segments: LessonSegment[];
};

export type VoiceTake = {
  id: string;
  label: string;
  url: string;
  blob: Blob;
  duration: number;
  createdAt: string;
};

export type AudioMetrics = {
  rms: number;
  peak: number;
  silenceRatio: number;
  pauseCount: number;
  energyVariation: number;
  duration: number;
};

export type AcousticFrame = {
  start: number;
  end: number;
  rms: number;
  dbfs: number;
  pitchHz: number | null;
  pitchConfidence: number;
  isSpeech: boolean;
};

export type SpeechInterval = {
  start: number;
  end: number;
  duration: number;
};

export type DetectedPause = {
  start: number;
  end: number;
  durationMs: number;
};

export type DetailedAudioMetrics = AudioMetrics & {
  sampleRate: number;
  noiseFloorDbfs: number;
  speechRatio: number;
  clippingRatio: number;
  medianSpeechDbfs: number;
  medianPitchHz: number | null;
  pitchRangeSemitones: number;
  voicedRatio: number;
  acousticSource?: "praat-parselmouth";
  acousticQuality?: "high" | "limited";
  intensityRangeDb?: number;
  hnrMeanDb?: number | null;
  frames: AcousticFrame[];
  speechIntervals: SpeechInterval[];
  pauses: DetectedPause[];
};

export type TimedWord = {
  word: string;
  start: number;
  end: number;
  confidence?: number;
};

export type ServerAcousticFrame = {
  time: number;
  pitchHz: number | null;
  intensityDb: number | null;
};

export type ServerAcousticAnalysis = {
  source: "praat-parselmouth";
  quality: "high" | "limited";
  sampleRate: number;
  frameStepMs: number;
  pitchMedianHz: number | null;
  pitchP10Hz: number | null;
  pitchP90Hz: number | null;
  pitchRangeSemitones: number;
  voicedRatio: number;
  intensityMeanDb: number | null;
  intensityRangeDb: number;
  hnrMeanDb: number | null;
  frames: ServerAcousticFrame[];
};

export type PhonemeInterval = {
  phone: string;
  start: number;
  end: number;
  durationMs: number;
  wordIndex: number | null;
  /**
   * MFA phone_goodness: écart acoustique moyen avec le meilleur téléphone
   * concurrent. 0 est idéal, une valeur plus élevée indique un écart plus fort.
   */
  phoneGoodness?: number | null;
};

export type PhonemeAlignment = {
  source: "montreal-forced-aligner";
  model: string;
  language: string;
  status: "aligned";
  scoreKind: "alignment-only" | "mfa-phone-confidence";
  scoringVersion: string;
  canScorePronunciation: boolean;
  confidenceCoverage: number;
  scoringReason: string;
  words: Array<{ word: string; start: number; end: number }>;
  phones: PhonemeInterval[];
};

export type PhoneAssessmentStatus = "good" | "fragile" | "retry" | "unscored";

export type PhoneAssessment = {
  phone: string;
  displayPhone: string;
  word: string | null;
  wordIndex: number | null;
  start: number;
  end: number;
  durationMs: number;
  phoneClass: "vowel" | "nasal" | "liquid" | "voiced-consonant" | "unvoiced-consonant" | "other";
  status: PhoneAssessmentStatus;
  score: number | null;
  acousticMatchScore: number | null;
  durationScore: number;
  presenceScore: number;
  voicedRatio: number | null;
  meanIntensityDb: number | null;
  feedback: string;
};

export type WordPronunciationAssessment = {
  word: string;
  wordIndex: number;
  score: number | null;
  status: PhoneAssessmentStatus;
  phones: PhoneAssessment[];
};

export type PronunciationAssessment = {
  engine: "voiceact-phonetic-v1";
  status: "scored" | "informative" | "unavailable";
  score: number | null;
  reliability: number;
  canValidate: boolean;
  scoringReason: string;
  evidenceCoverage: number;
  assessedPhoneCount: number;
  weakPhoneCount: number;
  phones: PhoneAssessment[];
  words: WordPronunciationAssessment[];
  priority: string | null;
};

export type TimestampedTranscription = {
  text: string;
  language: string | null;
  duration: number | null;
  words: TimedWord[];
  provider: "openai" | "voiceact-local";
  model: string;
  alignment?: "openai" | "faster-whisper" | "whisperx";
  processingMs?: number;
  acoustics?: ServerAcousticAnalysis;
  phonemeAlignment?: PhonemeAlignment;
  phonemeAlignmentError?: string;
};

export type WordAlignmentStatus = "matched" | "substituted" | "omitted" | "inserted";

export type WordAlignment = {
  expected: string | null;
  actual: string | null;
  segmentIndex: number | null;
  start: number | null;
  end: number | null;
  status: WordAlignmentStatus;
};

export type SegmentAnalysis = {
  segmentIndex: number;
  text: string;
  start: number | null;
  end: number | null;
  detectedWpm: number | null;
  targetWpm: number;
  actualPauseAfterMs: number | null;
  targetPauseAfterMs: number;
  dictionScore: number;
  paceScore: number | null;
  pauseScore: number | null;
  energyScore: number | null;
  intonationScore: number | null;
  feedback: string;
};

export type AnalysisMode = "full" | "local-only";

export type AnalysisStatus = "scored" | "no-speech" | "analysis-unavailable";

export type VoiceDimensionScores = {
  clarity: number;
  rhythm: number;
  intonation: number;
  expressiveness: number;
  technical: number;
};

export type VoiceGoal = "Createur video" | "Doublage cinema" | "Voix off publicitaire" | "Narration documentaire";

export type VoiceSpecialty =
  | "Short dynamique"
  | "Video longue storytelling"
  | "Actualite journalisme"
  | "Horreur suspense"
  | "Publicite UGC"
  | "Film serie"
  | "Animation dessin anime"
  | "Jeu video";

export type OnboardingProfile = {
  goal: VoiceGoal;
  specialty?: VoiceSpecialty;
  level: "Debutant" | "Intermediaire" | "Avance";
  /** Sert uniquement a calibrer les plages acoustiques, jamais a imposer une voix modele. */
  sex?: "Femme" | "Homme" | "Prefere ne pas dire";
  /** Voix que l'apprenant souhaite entendre dans les exemples. */
  referenceVoicePreference?: "Feminine" | "Masculine" | "Alternee";
  frequency: "5 minutes par jour" | "10 minutes par jour" | "3 fois par semaine";
  completedAt: string;
};

export type BaselineRecord = {
  attemptId: string;
  lessonId: string;
  score: number;
  dimensions: VoiceDimensionScores;
  transcript: string;
  confidence: number;
  createdAt: string;
  audioStored: boolean;
};

export type AnalysisResult = {
  analysisStatus: AnalysisStatus;
  globalScore: number;
  wpm: number;
  targetWpm: number;
  pauseCount: number;
  expectedPauses: number;
  silencePercent: number;
  rmsPercent: number;
  peakPercent: number;
  energyVariationPercent: number;
  badge: string;
  advice: string;
  nextGoal: string;
  xpEarned: number;
  analysisMode?: AnalysisMode;
  confidence?: number;
  canValidate?: boolean;
  analysisModel?: string;
  validationReason?: string;
  failureReason?: string;
  acousticSource?: "praat-parselmouth";
  acousticQuality?: "high" | "limited";
  intensityRangeDb?: number;
  hnrMeanDb?: number | null;
  phonemeAlignmentStatus?: "aligned" | "unavailable";
  phonemeCount?: number;
  phonemeScoringReason?: string;
  pronunciation?: PronunciationAssessment;
  transcript?: string;
  wordAccuracyPercent?: number;
  matchedWords?: number;
  expectedWords?: number;
  medianPitchHz?: number | null;
  pitchRangeSemitones?: number;
  clippingPercent?: number;
  dimensionScores?: VoiceDimensionScores;
  segmentAnalyses?: SegmentAnalysis[];
};

export type PracticeHistoryEntry = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  badge: string;
  wpm: number;
  targetWpm: number;
  pauseCount: number;
  expectedPauses: number;
  silencePercent: number;
  energyVariationPercent: number;
  dimensionScores?: VoiceDimensionScores;
  analysisMode?: AnalysisMode;
  canValidate?: boolean;
  confidence?: number;
  audioAttemptId?: string;
  recommendedLessonId?: string;
  createdAt: string;
};
