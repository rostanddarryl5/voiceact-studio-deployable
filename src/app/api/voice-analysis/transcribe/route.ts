import { NextResponse } from "next/server";
import {
  getProviderStatus,
  transcribeAudio,
  TranscriptionProviderError,
} from "@/lib/server/transcription-providers";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const SUPPORTED_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
]);

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  return NextResponse.json(await getProviderStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return jsonError(400, "INVALID_MULTIPART", "Le fichier audio n'a pas pu être lu.");
  }

  const file = incoming.get("audio");
  if (!(file instanceof File)) return jsonError(400, "AUDIO_REQUIRED", "Un fichier audio est requis.");
  if (file.size < 512) return jsonError(400, "AUDIO_EMPTY", "Le fichier audio est vide ou incomplet.");
  if (file.size > MAX_AUDIO_BYTES) return jsonError(413, "AUDIO_TOO_LARGE", "Le fichier audio dépasse 24 Mo.");

  const baseType = file.type.split(";")[0]?.toLowerCase();
  if (baseType && !SUPPORTED_TYPES.has(baseType)) {
    return jsonError(415, "AUDIO_TYPE_UNSUPPORTED", `Format audio non pris en charge : ${baseType}.`);
  }
  const expectedTextValue = incoming.get("expectedText");
  const expectedText = typeof expectedTextValue === "string" ? expectedTextValue.trim() : undefined;
  if (expectedText && expectedText.length > 2_000) {
    return jsonError(400, "EXPECTED_TEXT_TOO_LONG", "Le texte attendu dépasse 2000 caractères.");
  }

  try {
    const result = await transcribeAudio(file, expectedText);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-VoiceAct-Analysis-Version": "3.0.0",
      },
    });
  } catch (error) {
    if (error instanceof TranscriptionProviderError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(500, "TRANSCRIPTION_INTERNAL_ERROR", "Une erreur interne a interrompu l'analyse vocale.");
  }
}
