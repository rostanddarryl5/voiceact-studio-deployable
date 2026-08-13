import { getTtsProfileById, getTtsScriptById } from "../../data/tts-reference-corpus";
import { buildGeminiTtsPrompt, type GeminiVoiceName } from "../tts-corpus";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const PCM_SAMPLE_RATE = 24_000;

export class GeminiTtsError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "GeminiTtsError";
  }
}

type GeminiTtsApiResponse = {
  output_audio?: { data?: string; sample_rate?: number };
  steps?: Array<{
    content?: Array<{
      data?: string;
      mime_type?: string;
      sample_rate?: number;
      type?: string;
    }>;
  }>;
  error?: { message?: string; status?: string };
};

export type GeminiReferenceAudio = {
  scriptId: string;
  voice: GeminiVoiceName;
  model: string;
  wav: Uint8Array;
  durationSeconds: number;
  attempts: number;
};

function writeAscii(target: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) target[offset + index] = value.charCodeAt(index);
}

/** Gemini TTS returns signed 16-bit little-endian PCM at 24 kHz. */
export function pcm16LeToWav(pcm: Uint8Array, sampleRate = PCM_SAMPLE_RATE) {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  writeAscii(header, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(header, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(header, 36, "data");
  view.setUint32(40, pcm.byteLength, true);
  const wav = new Uint8Array(header.byteLength + pcm.byteLength);
  wav.set(header);
  wav.set(pcm, header.byteLength);
  return wav;
}

function getGeminiAudioContent(payload: GeminiTtsApiResponse) {
  // Interactions renvoie l'audio final dans steps[].content[] ; output_audio est
  // conservé comme compatibilité avec certaines réponses antérieures.
  return payload.steps?.flatMap((step) => step.content ?? []).find((content) => Boolean(content.data))
    ?? payload.output_audio;
}

export function parseGeminiPcmResponse(payload: GeminiTtsApiResponse) {
  const data = getGeminiAudioContent(payload)?.data;
  if (!data) throw new GeminiTtsError(502, "GEMINI_TTS_NO_AUDIO", "Gemini n'a pas retourné d'audio exploitable.");
  try {
    const raw = Buffer.from(data, "base64");
    if (raw.byteLength < 480) throw new Error("too short");
    return new Uint8Array(raw);
  } catch {
    throw new GeminiTtsError(502, "GEMINI_TTS_INVALID_AUDIO", "La réponse audio Gemini est invalide.");
  }
}

function getGeminiSampleRate(payload: GeminiTtsApiResponse) {
  const candidate = getGeminiAudioContent(payload)?.sample_rate;
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 8_000 && candidate <= 48_000
    ? candidate
    : PCM_SAMPLE_RATE;
}

function wavDurationSeconds(wav: Uint8Array, sampleRate: number) {
  return Number(((wav.byteLength - 44) / (sampleRate * 2)).toFixed(3));
}

function allowedVoice(scriptId: string, requestedVoice: GeminiVoiceName | undefined) {
  const script = getTtsScriptById(scriptId);
  if (!script) throw new GeminiTtsError(404, "SCRIPT_NOT_FOUND", "Script de référence introuvable.");
  const profile = getTtsProfileById(script.profileId);
  if (!profile) throw new GeminiTtsError(500, "PROFILE_NOT_FOUND", "Profil de direction vocale introuvable.");
  const voice = requestedVoice ?? script.voice.primary;
  if (![script.voice.primary, ...script.voice.alternates, profile.defaultVoice, ...profile.alternateVoices].includes(voice)) {
    throw new GeminiTtsError(400, "VOICE_NOT_ALLOWED", "Cette voix n'est pas autorisée pour ce script.");
  }
  return { script, profile, voice };
}

export function buildGeminiReferenceRequest(scriptId: string, requestedVoice?: GeminiVoiceName) {
  const { script, profile, voice } = allowedVoice(scriptId, requestedVoice);
  const direction = buildGeminiTtsPrompt(script, profile);
  return {
    script,
    voice,
    body: {
      model: process.env.VOICEACT_GEMINI_TTS_MODEL || DEFAULT_MODEL,
      input: [
        "SYNTHESIZE SPEECH ONLY. Never read the audio profile, scene, director notes, tags, or headings aloud.",
        "Speak only the lines inside the TRANSCRIPT section, following the direction silently.",
        direction,
      ].join("\n\n"),
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    },
  };
}

export async function generateGeminiReferenceAudio(scriptId: string, requestedVoice?: GeminiVoiceName): Promise<GeminiReferenceAudio> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiTtsError(503, "GEMINI_TTS_NOT_CONFIGURED", "La clé Gemini TTS n'est pas configurée sur le serveur.");
  const request = buildGeminiReferenceRequest(scriptId, requestedVoice);
  const model = request.body.model;
  let lastError: GeminiTtsError | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(GEMINI_INTERACTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20",
        },
        body: JSON.stringify(request.body),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as GeminiTtsApiResponse;
      if (!response.ok) {
        throw new GeminiTtsError(response.status, "GEMINI_TTS_UPSTREAM", payload.error?.message || "Gemini a refusé la génération TTS.");
      }
      const sampleRate = getGeminiSampleRate(payload);
      const wav = pcm16LeToWav(parseGeminiPcmResponse(payload), sampleRate);
      const durationSeconds = wavDurationSeconds(wav, sampleRate);
      const [minimumSeconds, maximumSeconds] = request.script.targetDurationSeconds;
      if (durationSeconds < minimumSeconds || durationSeconds > maximumSeconds) {
        if (process.env.VOICEACT_GEMINI_SAVE_DURATION_CANDIDATES === "true") {
          return {
            scriptId,
            voice: request.voice,
            model,
            wav,
            durationSeconds,
            attempts: attempt,
          };
        }
        throw new GeminiTtsError(
          422,
          "GEMINI_TTS_DURATION_MISMATCH",
          `La référence dure ${durationSeconds}s, hors contrat pédagogique ${minimumSeconds}-${maximumSeconds}s.`,
        );
      }
      return {
        scriptId,
        voice: request.voice,
        model,
        wav,
        durationSeconds,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof GeminiTtsError
        ? error
        : new GeminiTtsError(502, "GEMINI_TTS_NETWORK", "Impossible de contacter Gemini TTS.");
      if (attempt === 2 || lastError.status < 500) throw lastError;
    }
  }
  throw lastError ?? new GeminiTtsError(502, "GEMINI_TTS_UNKNOWN", "La génération TTS a échoué.");
}

export function getGeminiTtsStatus() {
  return {
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: process.env.VOICEACT_GEMINI_TTS_MODEL || DEFAULT_MODEL,
    freeTierHint: process.env.VOICEACT_GEMINI_TTS_FREE_TIER === "true",
    requiresHumanReview: true,
  };
}
