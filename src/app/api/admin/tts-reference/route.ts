import { NextResponse } from "next/server";
import { GeminiTtsError, generateGeminiReferenceAudio, getGeminiTtsStatus } from "@/lib/server/gemini-tts";
import type { GeminiVoiceName } from "@/lib/tts-corpus";

export const runtime = "nodejs";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function authorized(request: Request) {
  const expected = process.env.VOICEACT_INTERNAL_TOKEN?.trim();
  return Boolean(expected && request.headers.get("x-voiceact-admin-token") === expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonError(401, "UNAUTHORIZED", "Autorisation administrateur requise.");
  return NextResponse.json(getGeminiTtsStatus(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonError(401, "UNAUTHORIZED", "Autorisation administrateur requise.");
  let body: { scriptId?: unknown; voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "La requête de génération est invalide.");
  }
  if (typeof body.scriptId !== "string" || !/^[a-z0-9-]{4,80}$/i.test(body.scriptId)) {
    return jsonError(400, "INVALID_SCRIPT", "Le script demandé est invalide.");
  }
  if (body.voice !== undefined && (typeof body.voice !== "string" || !/^[A-Za-z]+$/.test(body.voice))) {
    return jsonError(400, "INVALID_VOICE", "La voix demandée est invalide.");
  }

  try {
    const generated = await generateGeminiReferenceAudio(body.scriptId, body.voice as GeminiVoiceName | undefined);
    // Next attend un ArrayBuffer Web (et non un Uint8Array Node générique).
    const wavBody = generated.wav.buffer.slice(
      generated.wav.byteOffset,
      generated.wav.byteOffset + generated.wav.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(wavBody, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(generated.wav.byteLength),
        "Content-Disposition": `attachment; filename="${generated.scriptId}-${generated.voice}.wav"`,
        "X-VoiceAct-TTS-Model": generated.model,
        "X-VoiceAct-TTS-Attempts": String(generated.attempts),
        "X-VoiceAct-TTS-Duration": String(generated.durationSeconds),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof GeminiTtsError) return jsonError(error.status, error.code, error.message);
    return jsonError(500, "GEMINI_TTS_INTERNAL", "Erreur interne durant la génération TTS.");
  }
}
