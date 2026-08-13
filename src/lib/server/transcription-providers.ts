import type { PhonemeAlignment, ServerAcousticAnalysis, TimestampedTranscription, TimedWord } from "@/lib/types";

type ProviderName = "local" | "openai" | "auto";

type ProviderStatus = {
  configured: boolean;
  provider: "voiceact-local" | "openai";
  model: string;
  reachable?: boolean;
  alignment?: string;
  standardAnalysisReady?: boolean;
  phonemeScoringReady?: boolean;
  phonemeServiceConfigured?: boolean;
};

type RemoteError = {
  error?: { code?: string; message?: string };
};

type OpenAIResponse = RemoteError & {
  text?: string;
  language?: string;
  duration?: number;
  words?: Array<{ word?: string; start?: number; end?: number }>;
};

export class TranscriptionProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function requestedProvider(): ProviderName {
  const value = process.env.VOICEACT_TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
  if (value === "local" || value === "openai" || value === "auto") return value;
  return process.env.VOICEACT_SPEECH_SERVICE_URL ? "local" : process.env.OPENAI_API_KEY ? "openai" : "local";
}

function localUrl(): string | null {
  const value = process.env.VOICEACT_SPEECH_SERVICE_URL?.trim().replace(/\/$/, "");
  return value || null;
}

function allowOpenAIFallback(): boolean {
  return process.env.VOICEACT_ALLOW_OPENAI_FALLBACK?.trim().toLowerCase() === "true";
}

function normalizeWords(words: unknown): TimedWord[] {
  if (!Array.isArray(words)) return [];
  return words.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const word = "word" in item && typeof item.word === "string" ? item.word.trim() : "";
    const start = "start" in item && typeof item.start === "number" ? item.start : null;
    const end = "end" in item && typeof item.end === "number" ? item.end : null;
    const confidence = "confidence" in item && typeof item.confidence === "number" ? item.confidence : undefined;
    if (!word || start === null || end === null || start < 0 || end < start) return [];
    return [{ word, start, end, confidence }];
  });
}

function normalizeAcoustics(value: unknown): ServerAcousticAnalysis | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (data.source !== "praat-parselmouth" || (data.quality !== "high" && data.quality !== "limited")) return undefined;
  if (!Array.isArray(data.frames) || typeof data.frameStepMs !== "number" || data.frameStepMs <= 0) return undefined;

  const frames = data.frames.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const frame = item as Record<string, unknown>;
    if (typeof frame.time !== "number" || frame.time < 0) return [];
    return [{
      time: frame.time,
      pitchHz: typeof frame.pitchHz === "number" && frame.pitchHz > 0 ? frame.pitchHz : null,
      intensityDb: typeof frame.intensityDb === "number" ? frame.intensityDb : null,
    }];
  });
  if (!frames.length) return undefined;

  const optionalNumber = (field: string) => typeof data[field] === "number" ? data[field] as number : null;
  return {
    source: "praat-parselmouth",
    quality: data.quality,
    sampleRate: typeof data.sampleRate === "number" ? data.sampleRate : 16_000,
    frameStepMs: data.frameStepMs,
    pitchMedianHz: optionalNumber("pitchMedianHz"),
    pitchP10Hz: optionalNumber("pitchP10Hz"),
    pitchP90Hz: optionalNumber("pitchP90Hz"),
    pitchRangeSemitones: optionalNumber("pitchRangeSemitones") ?? 0,
    voicedRatio: optionalNumber("voicedRatio") ?? 0,
    intensityMeanDb: optionalNumber("intensityMeanDb"),
    intensityRangeDb: optionalNumber("intensityRangeDb") ?? 0,
    hnrMeanDb: optionalNumber("hnrMeanDb"),
    frames,
  };
}

function normalizePhonemeAlignment(value: unknown): PhonemeAlignment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (data.source !== "montreal-forced-aligner" || data.status !== "aligned" || !Array.isArray(data.phones)) return undefined;
  const phones = data.phones.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const phone = item as Record<string, unknown>;
    if (typeof phone.phone !== "string" || typeof phone.start !== "number" || typeof phone.end !== "number") return [];
    return [{
      phone: phone.phone,
      start: phone.start,
      end: phone.end,
      durationMs: typeof phone.durationMs === "number" ? phone.durationMs : Math.round((phone.end - phone.start) * 1_000),
      wordIndex: typeof phone.wordIndex === "number" ? phone.wordIndex : null,
      phoneGoodness: typeof phone.phoneGoodness === "number" && phone.phoneGoodness >= 0
        ? phone.phoneGoodness
        : null,
    }];
  });
  if (!phones.length) return undefined;
  const words = Array.isArray(data.words) ? data.words.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const word = item as Record<string, unknown>;
    return typeof word.word === "string" && typeof word.start === "number" && typeof word.end === "number"
      ? [{ word: word.word, start: word.start, end: word.end }]
      : [];
  }) : [];
  return {
    source: "montreal-forced-aligner",
    model: typeof data.model === "string" ? data.model : "french_mfa",
    language: typeof data.language === "string" ? data.language : "fr",
    status: "aligned",
    scoreKind: data.scoreKind === "mfa-phone-confidence" ? "mfa-phone-confidence" : "alignment-only",
    scoringVersion: typeof data.scoringVersion === "string" ? data.scoringVersion : "mfa-boundaries-v1",
    canScorePronunciation: data.canScorePronunciation === true,
    confidenceCoverage: typeof data.confidenceCoverage === "number"
      ? Math.max(0, Math.min(1, data.confidenceCoverage))
      : 0,
    scoringReason: typeof data.scoringReason === "string"
      ? data.scoringReason
      : "L'alignement phonémique est informatif et n'est pas encore calibré pour noter la prononciation.",
    words,
    phones,
  };
}

function assertLocalResponse(value: unknown): TimestampedTranscription {
  if (!value || typeof value !== "object") {
    throw new TranscriptionProviderError(502, "INVALID_LOCAL_RESPONSE", "Le moteur vocal a renvoyé une réponse invalide.");
  }
  const data = value as Record<string, unknown>;
  const words = normalizeWords(data.words);
  if (typeof data.text !== "string" || !data.text.trim() || words.length === 0) {
    throw new TranscriptionProviderError(422, "TIMESTAMPS_MISSING", "La parole n'a pas pu être horodatée précisément.");
  }
  return {
    text: data.text.trim(),
    language: typeof data.language === "string" ? data.language : null,
    duration: typeof data.duration === "number" ? data.duration : null,
    words,
    provider: "voiceact-local",
    model: typeof data.model === "string" ? data.model : "unknown",
    alignment: data.alignment === "whisperx" ? "whisperx" : "faster-whisper",
    processingMs: typeof data.processingMs === "number" ? data.processingMs : undefined,
    acoustics: normalizeAcoustics(data.acoustics),
    phonemeAlignment: normalizePhonemeAlignment(data.phonemeAlignment),
    phonemeAlignmentError: typeof data.phonemeAlignmentError === "string" ? data.phonemeAlignmentError : undefined,
  };
}

async function transcribeLocal(file: File, expectedText?: string): Promise<TimestampedTranscription> {
  const baseUrl = localUrl();
  if (!baseUrl) {
    throw new TranscriptionProviderError(503, "LOCAL_TRANSCRIPTION_NOT_CONFIGURED", "Le moteur vocal local n'est pas configuré.");
  }

  const body = new FormData();
  body.append("audio", file, file.name || "voiceact-recording.webm");
  if (expectedText) body.append("expected_text", expectedText);
  const token = process.env.VOICEACT_SPEECH_SERVICE_TOKEN?.trim();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/transcriptions?language=fr`, {
      method: "POST",
      headers: token ? { "X-VoiceAct-Internal-Token": token } : undefined,
      body,
      signal: AbortSignal.timeout(28_000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new TranscriptionProviderError(
      timedOut ? 504 : 502,
      timedOut ? "LOCAL_TRANSCRIPTION_TIMEOUT" : "LOCAL_TRANSCRIPTION_UNREACHABLE",
      timedOut ? "Le moteur vocal local n'est pas prêt ou met trop longtemps à répondre." : "Le moteur vocal local est momentanément inaccessible.",
    );
  }

  const data = (await response.json().catch(() => ({}))) as RemoteError;
  if (!response.ok) {
    throw new TranscriptionProviderError(
      response.status,
      data.error?.code ?? "LOCAL_TRANSCRIPTION_FAILED",
      data.error?.message ?? "Le moteur vocal local n'a pas pu analyser cet audio.",
    );
  }
  return assertLocalResponse(data);
}

async function transcribeOpenAI(file: File): Promise<TimestampedTranscription> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TranscriptionProviderError(503, "OPENAI_NOT_CONFIGURED", "Le service OpenAI n'est pas configuré.");
  }

  const started = performance.now();
  const body = new FormData();
  body.append("file", file, file.name || "voiceact-recording.webm");
  body.append("model", "whisper-1");
  body.append("language", "fr");
  body.append("response_format", "verbose_json");
  body.append("timestamp_granularities[]", "word");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new TranscriptionProviderError(
      timedOut ? 504 : 502,
      timedOut ? "OPENAI_TIMEOUT" : "OPENAI_UNREACHABLE",
      timedOut ? "La transcription a dépassé 60 secondes." : "Le service OpenAI est momentanément inaccessible.",
    );
  }

  const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) {
    const message = response.status === 429
      ? "Le quota OpenAI est momentanément atteint."
      : response.status === 401
        ? "La clé OpenAI est invalide."
        : "OpenAI n'a pas pu analyser cet audio.";
    throw new TranscriptionProviderError(response.status, data.error?.code ?? "OPENAI_FAILED", message);
  }

  const words = normalizeWords(data.words);
  if (!data.text?.trim() || words.length === 0) {
    throw new TranscriptionProviderError(422, "TIMESTAMPS_MISSING", "La parole n'a pas pu être horodatée précisément.");
  }
  return {
    text: data.text.trim(),
    language: data.language ?? "fr",
    duration: typeof data.duration === "number" ? data.duration : null,
    words,
    provider: "openai",
    model: "whisper-1",
    alignment: "openai",
    processingMs: Math.round(performance.now() - started),
  };
}

export async function transcribeAudio(file: File, expectedText?: string): Promise<TimestampedTranscription> {
  const provider = requestedProvider();
  if (provider === "openai") return transcribeOpenAI(file);

  try {
    return await transcribeLocal(file, expectedText);
  } catch (error) {
    const canFallback = (provider === "auto" || allowOpenAIFallback()) && allowOpenAIFallback() && Boolean(process.env.OPENAI_API_KEY);
    if (!canFallback) throw error;
    return transcribeOpenAI(file);
  }
}

export async function getProviderStatus(): Promise<{
  configured: boolean;
  selected: ProviderName;
  paidFallbackEnabled: boolean;
  providers: ProviderStatus[];
}> {
  const selected = requestedProvider();
  const baseUrl = localUrl();
  let localReachable = false;
  let localModel = process.env.VOICEACT_MODEL_SIZE || "small";
  let localAlignment = process.env.VOICEACT_ALIGNMENT || "whisperx";
  let phonemeServiceConfigured = false;
  let phonemeScoringReady = false;

  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/health/ready`, {
        signal: AbortSignal.timeout(2_500),
        cache: "no-store",
      });
      localReachable = response.ok;
      const health = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (typeof health.model === "string") localModel = health.model;
      if (typeof health.alignmentMode === "string") localAlignment = health.alignmentMode;
      phonemeServiceConfigured = health.phonemeServiceConfigured === true;
      phonemeScoringReady = localReachable && phonemeServiceConfigured && localAlignment !== "off";
    } catch {
      localReachable = false;
    }
  }

  const localConfigured = Boolean(baseUrl);
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY);
  const configured = selected === "openai" ? openAIConfigured : localConfigured;
  return {
    configured,
    selected,
    paidFallbackEnabled: allowOpenAIFallback() && openAIConfigured,
    providers: [
      {
        configured: localConfigured,
        provider: "voiceact-local",
        model: localModel,
        reachable: localReachable,
        alignment: localAlignment,
        standardAnalysisReady: localReachable,
        phonemeScoringReady,
        phonemeServiceConfigured,
      },
      { configured: openAIConfigured, provider: "openai", model: "whisper-1" },
    ],
  };
}
