import { assertTtsCorpus, buildGeminiTtsPrompt } from "../lib/tts-corpus";
import { dubbingReferenceScripts } from "./tts-reference-scripts-dubbing";
import { creatorReferenceScripts } from "./tts-reference-scripts-creator";
import { ttsVoiceProfiles } from "./tts-voice-profiles";

export const ttsReferenceScripts = [
  ...creatorReferenceScripts,
  ...dubbingReferenceScripts,
];

assertTtsCorpus(ttsReferenceScripts, ttsVoiceProfiles);

export function getTtsScriptById(id: string) {
  return ttsReferenceScripts.find((script) => script.id === id) ?? null;
}

export function getTtsProfileById(id: string) {
  return ttsVoiceProfiles.find((profile) => profile.id === id) ?? null;
}

export function getGeminiPromptForScript(id: string) {
  const script = getTtsScriptById(id);
  if (!script) return null;
  const profile = getTtsProfileById(script.profileId);
  if (!profile) return null;
  return buildGeminiTtsPrompt(script, profile);
}

export const ttsCorpusStats = {
  scriptCount: ttsReferenceScripts.length,
  profileCount: ttsVoiceProfiles.length,
  specialtyCount: new Set(ttsReferenceScripts.map((script) => script.specialty)).size,
  beatCount: ttsReferenceScripts.reduce((total, script) => total + script.beats.length, 0),
};
