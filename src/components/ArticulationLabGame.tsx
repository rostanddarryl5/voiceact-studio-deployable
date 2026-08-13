"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeAudioBlobDetailed,
  formatDuration,
  getPreferredRecorderOptions,
  mergeServerAcoustics,
} from "@/lib/audio-analysis";
import {
  articulationDrills,
  createArticulationLesson,
  didPassArticulationDrill,
  isArticulationDrillUnlocked,
  type ArticulationDrill,
} from "@/lib/articulation-lab-model";
import {
  isPhonemeScoringReady,
  isTranscriptionUsable,
  requestTimestampedTranscription,
  type TranscriptionServiceStatus,
} from "@/lib/transcription-client";
import type { AnalysisResult, VoiceTake } from "@/lib/types";
import { buildVoiceAnalysis } from "@/lib/voice-engine";

type LabPhase = "guide" | "ready" | "countdown" | "recording" | "analyzing" | "result" | "error";

type LabAttempt = {
  drillId: string;
  analysis: AnalysisResult;
  take: VoiceTake;
  passed: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function standardPass(drill: ArticulationDrill, analysis: AnalysisResult | null, advancedReady: boolean) {
  if (!analysis || analysis.analysisStatus !== "scored" || !analysis.canValidate) return false;
  if (advancedReady) return didPassArticulationDrill(drill, analysis);
  return (analysis.wordAccuracyPercent ?? 0) >= 82 && analysis.globalScore >= Math.max(66, drill.passThreshold - 4);
}

function resultTitle(analysis: AnalysisResult | null, passed: boolean, advancedReady: boolean) {
  if (!analysis) return "À toi de jouer.";
  if (analysis.analysisStatus === "no-speech") return "Je n'ai pas entendu assez de voix.";
  if (!analysis.canValidate) return "Prise trop fragile.";
  if (passed) return advancedReady ? "Précision validée." : "Entraînement validé.";
  return "Encore une prise propre.";
}

export default function ArticulationLabGame({ speechStatus }: { speechStatus: TranscriptionServiceStatus }) {
  const [drillIndex, setDrillIndex] = useState(0);
  const [phase, setPhase] = useState<LabPhase>("guide");
  const [guideStep, setGuideStep] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveLevel, setLiveLevel] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, LabAttempt>>({});
  const [currentAttempt, setCurrentAttempt] = useState<LabAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const drill = articulationDrills[drillIndex] ?? articulationDrills[0];
  const lesson = useMemo(() => createArticulationLesson(drill.id), [drill.id]);
  const analysis = currentAttempt?.analysis ?? null;
  const transcriptionReady = isTranscriptionUsable(speechStatus);
  const advancedReady = isPhonemeScoringReady(speechStatus);
  const passed = standardPass(drill, analysis, advancedReady);
  const passedCount = Object.values(attempts).filter((attempt) => attempt.passed).length;
  const weakestPhone = analysis?.pronunciation?.phones
    ?.filter((phone) => drill.targetPhones.includes(phone.displayPhone) || drill.targetPhones.includes(phone.phone))
    ?.sort((left, right) => (left.score ?? 101) - (right.score ?? 101))[0];

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    if (meterFrameRef.current) window.cancelAnimationFrame(meterFrameRef.current);
    audioContextRef.current?.close().catch(() => undefined);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function stopMeter() {
    if (meterFrameRef.current) window.cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setLiveLevel(0);
  }

  function startMeter(stream: MediaStream) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const source = audioContext.createMediaStreamSource(stream);
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const normalized = ((samples[index] ?? 128) - 128) / 128;
        energy += normalized * normalized;
      }
      setLiveLevel(Math.min(100, Math.round(Math.sqrt(energy / samples.length) * 235)));
      meterFrameRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }

  async function analyzeBlob(blob: Blob, duration: number) {
    setPhase("analyzing");
    try {
      const [metrics, transcriptionAttempt] = await Promise.all([
        analyzeAudioBlobDetailed(blob),
        requestTimestampedTranscription(blob, drill.text),
      ]);
      const measuredMetrics = mergeServerAcoustics(metrics, transcriptionAttempt.transcription?.acoustics);
      const nextAnalysis = buildVoiceAnalysis(lesson, measuredMetrics, transcriptionAttempt.transcription, transcriptionAttempt.errorMessage);
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);
      const nextPassed = standardPass(drill, nextAnalysis, advancedReady);
      const nextAttempt: LabAttempt = {
        drillId: drill.id,
        analysis: nextAnalysis,
        passed: nextPassed,
        take: {
          id: crypto.randomUUID(),
          label: `Articulation ${drillIndex + 1}`,
          url,
          blob,
          duration,
          createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        },
      };
      setCurrentAttempt(nextAttempt);
      setAttempts((current) => ({ ...current, [drill.id]: nextAttempt }));
      setPhase("result");
    } catch {
      setError("Analyse impossible. Recommence dans un endroit calme, sans parler trop loin du micro.");
      setPhase("error");
    }
  }

  async function beginRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ton navigateur ne permet pas l'enregistrement micro.");
      setPhase("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, getPreferredRecorderOptions());
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = window.performance.now();
      setRecordingTime(0);
      startMeter(stream);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const duration = startedAtRef.current ? (window.performance.now() - startedAtRef.current) / 1_000 : 0;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopMeter();
        void analyzeBlob(blob, duration);
      };
      recorder.start();
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setRecordingTime(startedAtRef.current ? (Date.now() - startedAtRef.current) / 1_000 : 0);
      }, 120);
    } catch {
      setError("Micro inaccessible. Autorise le micro dans le navigateur puis recommence.");
      setPhase("error");
    }
  }

  function startCountdown() {
    if (!transcriptionReady) {
      setError("Le moteur vocal doit être prêt avant de noter l'articulation.");
      setPhase("error");
      return;
    }
    setError(null);
    setCountdown(3);
    setPhase("countdown");
    countdownRef.current = window.setInterval(() => {
      setCountdown((current) => {
        if (!current || current <= 1) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          countdownRef.current = null;
          void beginRecording();
          return null;
        }
        return current - 1;
      });
    }, 720);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPhase("analyzing");
  }

  function selectDrill(index: number) {
    const passedIds = new Set(Object.values(attempts).filter((attempt) => attempt.passed).map((attempt) => attempt.drillId));
    if (!isArticulationDrillUnlocked(index, passedIds) || phase === "recording" || phase === "countdown") return;
    setDrillIndex(index);
    setCurrentAttempt(attempts[articulationDrills[index]?.id ?? ""] ?? null);
    setPhase("ready");
    setError(null);
  }

  function nextDrill() {
    selectDrill(Math.min(articulationDrills.length - 1, drillIndex + 1));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="overflow-hidden rounded-[36px] border border-[#22D3EE]/20 bg-[#100C1F] shadow-2xl shadow-black/25">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#22D3EE]/12 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#67E8F9]">Articulation Lab</span>
              <span className="rounded-full bg-[#A3E635]/12 px-3 py-1 text-xs font-black text-[#BEF264]">
                {advancedReady ? "Précision phonétique avancée" : "Mode standard : texte + clarté"}
              </span>
            </div>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">{drill.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#B9ACD7]">{drill.cue}</p>

            <div className="mt-6 rounded-[30px] border border-white/10 bg-[#080612] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">1 · Préparation non notée</p>
              <p className="mt-3 text-xl font-black text-white">{drill.preparation}</p>
              <p className="mt-3 rounded-2xl bg-[#FBBF24]/10 p-3 text-sm font-bold leading-6 text-[#FDE68A]">{drill.safeStopRule}</p>
            </div>

            <div className="mt-4 rounded-[30px] border border-[#8B5CF6]/25 bg-[#161228] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A78BFA]">2 · Phrase à enregistrer</p>
              <p className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{drill.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {drill.targetPhones.map((phone) => (
                  <span key={phone} className="rounded-full border border-[#22D3EE]/25 bg-[#22D3EE]/10 px-3 py-1 text-sm font-black text-[#A5F3FC]">/{phone}/</span>
                ))}
                <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-bold text-[#B9ACD7]">{drill.targetWpm} MPM cible</span>
              </div>
            </div>

            <div className="mt-5 rounded-[30px] border border-white/10 bg-[#080612] p-5">
              {phase === "guide" ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Guidage</p>
                  <h3 className="mt-2 text-2xl font-black">On y va étape par étape.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">
                    {[
                      "D'abord, fais juste la préparation. Elle n'est jamais notée.",
                      "Ensuite, lis une seule phrase courte. Pas de vitesse forcée : on cherche la netteté.",
                      "Après la prise, VoiceAct donne une seule priorité de correction avant la reprise.",
                    ][guideStep]}
                  </p>
                  <button className="warmup-primary-button mt-5" onClick={() => guideStep >= 2 ? setPhase("ready") : setGuideStep((step) => step + 1)}>
                    {guideStep >= 2 ? "Commencer l'exercice" : "Compris"}
                  </button>
                </div>
              ) : null}

              {phase === "ready" || phase === "error" ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">3 · Enregistrement</p>
                    <p className="mt-2 text-sm font-bold text-[#B9ACD7]">Appuie, attends le compte à rebours, lis une seule fois.</p>
                    {error ? <p className="mt-2 text-sm font-black text-[#FDA4AF]">{error}</p> : null}
                  </div>
                  <button className="warmup-primary-button" disabled={!transcriptionReady} onClick={startCountdown}>Enregistrer</button>
                </div>
              ) : null}

              {phase === "countdown" ? <div className="grid place-items-center py-8"><span className="grid size-28 place-items-center rounded-full bg-[#A3E635] text-5xl font-black text-[#0D0A1A]">{countdown}</span></div> : null}

              {phase === "recording" ? (
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FB7185]">J&apos;écoute</p>
                      <p className="mt-1 text-sm font-bold text-[#B9ACD7]">Volume micro · {formatDuration(recordingTime)}</p>
                    </div>
                    <button className="warmup-primary-button bg-[#FB7185]" onClick={stopRecording}>Stop</button>
                  </div>
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#A3E635] transition-[width]" style={{ width: `${liveLevel}%` }} />
                  </div>
                </div>
              ) : null}

              {phase === "analyzing" ? <p className="py-8 text-center text-sm font-black uppercase tracking-[0.2em] text-[#A3E635]">Analyse de ta diction...</p> : null}

              {phase === "result" ? (
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className={cx("grid place-items-center rounded-[28px] border p-5 text-center", passed ? "border-[#A3E635]/40 bg-[#A3E635]/10" : "border-[#FBBF24]/35 bg-[#FBBF24]/10")}>
                    <p className="text-5xl font-black">{analysis?.analysisStatus === "scored" ? analysis.globalScore : "--"}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-[#B9ACD7]">Score</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Retour coach</p>
                    <h3 className="mt-2 text-3xl font-black">{resultTitle(analysis, passed, advancedReady)}</h3>
                    <p className="mt-3 text-base leading-7 text-[#D8CCF4]">
                      {analysis?.advice ?? "Refais une prise courte et nette."}
                    </p>
                    {weakestPhone ? (
                      <p className="mt-3 rounded-2xl bg-[#22D3EE]/10 p-3 text-sm font-black text-[#A5F3FC]">
                        Son à surveiller : /{weakestPhone.displayPhone}/ · {weakestPhone.feedback}
                      </p>
                    ) : null}
                    {!advancedReady ? (
                      <p className="mt-3 text-xs font-bold leading-5 text-[#FDE68A]">MFA n&apos;est pas actif : l&apos;exercice donne une validation standard, pas encore une note phonétique complète.</p>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button className="warmup-primary-button" onClick={() => setPhase("ready")}>Reprendre</button>
                      {passed && drillIndex < articulationDrills.length - 1 ? <button className="warmup-secondary-button" onClick={nextDrill}>Débloquer la suite</button> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="border-t border-white/10 bg-[#080612]/70 p-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Progression</p>
            <p className="mt-2 text-4xl font-black">{passedCount}/{articulationDrills.length}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {articulationDrills.map((item, index) => {
                const passedItem = attempts[item.id]?.passed;
                const passedIds = new Set(Object.values(attempts).filter((attempt) => attempt.passed).map((attempt) => attempt.drillId));
                const unlocked = isArticulationDrillUnlocked(index, passedIds);
                return (
                  <button
                    key={item.id}
                    disabled={!unlocked || phase === "recording" || phase === "countdown"}
                    className={cx(
                      "min-h-16 rounded-2xl text-xs font-black transition",
                      index === drillIndex ? "bg-[#22D3EE] text-[#07111A]" : passedItem ? "bg-[#A3E635] text-[#0D0A1A]" : unlocked ? "bg-white/10 text-white" : "cursor-not-allowed bg-white/[0.035] text-[#5E5574]",
                    )}
                    onClick={() => selectDrill(index)}
                  >
                    {unlocked ? index + 1 : "·"}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 rounded-[26px] border border-white/10 bg-[#161228] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FBBF24]">Règle produit</p>
              <p className="mt-2 text-sm leading-6 text-[#B9ACD7]">Un exercice à la fois. Une consigne. Une phrase. Une correction. Pas de page surchargée.</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
