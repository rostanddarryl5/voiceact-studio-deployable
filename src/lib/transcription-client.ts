import type { TimestampedTranscription } from "./types";

export type TranscriptionAttempt = {
  transcription: TimestampedTranscription | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type TranscriptionServiceStatus = "checking" | "standard" | "advanced" | "offline";

type HealthResponse = {
  status?: "ready" | "degraded";
  mode?: "standard" | "advanced" | "offline";
  transcription?: {
    providers?: Array<{
      provider?: string;
      reachable?: boolean;
      standardAnalysisReady?: boolean;
      phonemeScoringReady?: boolean;
    }>;
  };
};

export function isTranscriptionUsable(status: TranscriptionServiceStatus) {
  return status === "standard" || status === "advanced";
}

export function isPhonemeScoringReady(status: TranscriptionServiceStatus) {
  return status === "advanced";
}

export async function requestTranscriptionServiceStatus(): Promise<TranscriptionServiceStatus> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as HealthResponse;
    const local = data.transcription?.providers?.find((provider) => provider.provider === "voiceact-local");
    if (local?.phonemeScoringReady) return "advanced";
    if (local?.standardAnalysisReady || local?.reachable || data.mode === "standard") return "standard";
    return response.ok ? "standard" : "offline";
  } catch {
    return "offline";
  }
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
}

export async function requestTimestampedTranscription(blob: Blob, expectedText?: string): Promise<TranscriptionAttempt> {
  const body = new FormData();
  const extension = extensionForMimeType(blob.type);
  body.append("audio", blob, `voiceact-take.${extension}`);
  if (expectedText) body.append("expectedText", expectedText);

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    const response = await fetch("/api/voice-analysis/transcribe", {
      method: "POST",
      body,
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeout));
    const data = await response.json().catch(() => ({})) as TimestampedTranscription & {
      error?: { code?: string; message?: string };
    };

    if (!response.ok) {
      return {
        transcription: null,
        errorCode: data.error?.code ?? "TRANSCRIPTION_FAILED",
        errorMessage: data.error?.message ?? "La transcription horodatée a échoué.",
      };
    }

    return { transcription: data, errorCode: null, errorMessage: null };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        transcription: null,
        errorCode: "TRANSCRIPTION_TIMEOUT",
        errorMessage: "Le moteur vocal n'est pas encore prêt. Relance VoiceAct ou attends la fin de préparation du modèle vocal.",
      };
    }
    return {
      transcription: null,
      errorCode: "TRANSCRIPTION_UNREACHABLE",
      errorMessage: "Le moteur de transcription est inaccessible.",
    };
  }
}
