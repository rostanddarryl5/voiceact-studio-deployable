import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/server/transcription-providers";

export const runtime = "nodejs";

export async function GET() {
  const status = await getProviderStatus();
  const local = status.providers.find((provider) => provider.provider === "voiceact-local");
  const ready = status.selected === "openai"
    ? status.configured
    : status.configured && local?.reachable === true;
  const mode = local?.phonemeScoringReady
    ? "advanced"
    : ready
      ? "standard"
      : "offline";

  return NextResponse.json(
    { status: ready ? "ready" : "degraded", mode, transcription: status },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
