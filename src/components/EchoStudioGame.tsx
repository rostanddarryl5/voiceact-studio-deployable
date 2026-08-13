"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeAudioBlobDetailed,
  formatDuration,
  getPreferredRecorderOptions,
  mergeServerAcoustics,
} from "@/lib/audio-analysis";
import { createEchoStudioModel, evaluateEchoStudioRound, type EchoStudioRoundResult } from "@/lib/echo-studio-model";
import { buildPromptWordTimings, curvePath, intonationLabel, pauseLabel } from "@/lib/prosody";
import { isPhonemeScoringReady, isTranscriptionUsable, requestTimestampedTranscription, type TranscriptionServiceStatus } from "@/lib/transcription-client";
import { buildVoiceAnalysis } from "@/lib/voice-engine";
import type { AnalysisResult, Lesson, LessonSegment, VoiceTake } from "@/lib/types";

type EchoPhase = "listen" | "countdown" | "recording" | "analyzing" | "result" | "complete" | "error";

type EchoAttempt = {
  roundIndex: number;
  analysis: AnalysisResult;
  result: EchoStudioRoundResult;
  take: VoiceTake;
};

export type EchoStudioCompletion = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  xpEarned: number;
  roundCount: number;
  analysis: AnalysisResult;
  createdAt: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roundLesson(baseLesson: Lesson, segment: LessonSegment, roundIndex: number): Lesson {
  return {
    ...baseLesson,
    id: `${baseLesson.id}-echo-${roundIndex + 1}`,
    title: `${baseLesson.title} - replique ${roundIndex + 1}`,
    segments: [segment],
  };
}

function timingWindow(segment: LessonSegment) {
  const first = segment.referenceWordTimings?.[0];
  const last = segment.referenceWordTimings?.at(-1);
  return {
    start: Math.max(0, ((first?.startMs ?? 0) - 220) / 1_000),
    end: Math.max(0.8, ((last?.endMs ?? 1_000) + 260) / 1_000),
  };
}

function scoreTone(result: EchoStudioRoundResult | null) {
  if (!result?.canValidate) return "bg-white/10 text-[#D8CCF4]";
  return result.passed ? "bg-[#A3E635] text-[#0D0A1A]" : "bg-[#FBBF24] text-[#1A1204]";
}

function EchoPrompterLine({
  active,
  segment,
  targetWpm,
  timelineKey,
}: {
  active: boolean;
  segment: LessonSegment;
  targetWpm: number;
  timelineKey: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const words = useMemo(() => {
    const raw = buildPromptWordTimings(segment, targetWpm);
    const firstStart = raw[0]?.startMs ?? 0;
    return raw.map((word) => ({ ...word, startMs: word.startMs - firstStart, endMs: word.endMs - firstStart }));
  }, [segment, targetWpm]);

  useEffect(() => {
    const stage = stageRef.current;
    const strip = stripRef.current;
    if (!stage || !strip) return;

    const anchors = Array.from(strip.querySelectorAll<HTMLElement>("[data-echo-time-ms]"))
      .map((element) => ({
        timeMs: Number(element.dataset.echoTimeMs),
        x: element.offsetLeft,
      }))
      .filter((anchor) => Number.isFinite(anchor.timeMs) && Number.isFinite(anchor.x))
      .sort((left, right) => left.timeMs - right.timeMs);
    const cueX = stage.clientWidth * 0.18;

    const placeAt = (elapsedMs: number) => {
      let anchorIndex = 0;
      while (anchorIndex < anchors.length - 2 && anchors[anchorIndex + 1].timeMs <= elapsedMs) anchorIndex += 1;
      const previous = anchors[anchorIndex];
      const next = anchors[Math.min(anchorIndex + 1, anchors.length - 1)];
      const anchoredX = previous && next
        ? previous.x + (next.x - previous.x) * Math.max(0, Math.min(1, (elapsedMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs)))
        : 0;
      strip.style.transform = `translate3d(${cueX - anchoredX}px, -50%, 0)`;
    };

    placeAt(0);
    if (!active) return;

    const startedAt = performance.now();
    const totalMs = Math.max(1_000, words.at(-1)?.endMs ?? 1_000);
    let frame = 0;
    const render = (now: number) => {
      const elapsedMs = Math.min(totalMs, now - startedAt);
      placeAt(elapsedMs);
      if (elapsedMs < totalMs) frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [active, timelineKey, words]);

  return (
    <div ref={stageRef} className={cx("echo-prompter relative h-36 overflow-hidden rounded-[26px] border border-white/10 bg-[#F8F6EF]", active && "is-active")}>
      <div className="absolute bottom-4 left-0 right-0 h-px bg-[#8B5CF6]/30" />
      <div className="absolute bottom-4 left-[18%] top-0 z-20 w-0.5 bg-[#EF4444] shadow-[0_0_24px_rgba(239,68,68,0.55)]">
        <span className="absolute -left-2 -top-1 size-4 rotate-45 bg-[#EF4444]" />
        <span className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-[#EF4444]" />
      </div>
      <p className="absolute left-[18%] top-3 z-20 -translate-x-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#EF4444]">A jouer</p>
      <div ref={stripRef} className="absolute left-0 top-1/2 flex w-max items-center gap-6 whitespace-nowrap pr-[80vw] will-change-transform">
        {words.map((word, index) => (
          <span
            key={`${word.word}-${index}`}
            className={cx(
              "echo-word text-2xl font-black text-[#171125] sm:text-4xl",
              word.accelerated && "text-[#8B5CF6]",
              word.sizeCue === "strong" && "text-3xl sm:text-5xl",
              word.sizeCue === "soft" && "text-lg opacity-75 sm:text-2xl",
            )}
            data-echo-time-ms={Math.round(word.startMs)}
            style={{ marginLeft: index === 0 ? 0 : `${Math.max(4, (word.startMs - (words[index - 1]?.endMs ?? 0)) * 0.09)}px` }}
          >
            {word.word}
          </span>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-3 bg-[#0D0A1A]/10">
        <div className={cx("h-full bg-[#8B5CF6]", active && "echo-progress")} />
      </div>
    </div>
  );
}

export default function EchoStudioGame({
  onComplete,
  speechStatus,
}: {
  onComplete: (completion: EchoStudioCompletion) => void;
  speechStatus: TranscriptionServiceStatus;
}) {
  const model = useMemo(() => createEchoStudioModel("short-01-anomalie"), []);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<EchoPhase>("listen");
  const [guideStep, setGuideStep] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem("voiceact-echo-studio-guide-v1") === "seen" ? 3 : 0,
  );
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveLevel, setLiveLevel] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, EchoAttempt>>({});
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const referenceStopRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const completedRunRef = useRef<string | null>(null);

  const round = model.rounds[roundIndex] ?? model.rounds[0];
  const segment = model.source.lesson.segments[roundIndex] ?? model.source.lesson.segments[0];
  const currentAttempt = attempts[roundIndex] ?? null;
  const completedCount = Object.values(attempts).filter((attempt) => attempt.result.passed).length;
  const isGuiding = guideStep < 3;
  const referencePath = model.source.lesson.referenceAudio?.localPath;
  const referenceReady = model.source.reference.state === "ready" && Boolean(referencePath);
  const transcriptionReady = isTranscriptionUsable(speechStatus);
  const advancedReady = isPhonemeScoringReady(speechStatus);
  const windowSeconds = segment ? timingWindow(segment) : { start: 0, end: 1 };

  useEffect(() => () => {
    if (referenceStopRef.current) window.clearInterval(referenceStopRef.current);
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
      setLiveLevel(Math.min(100, Math.round(Math.sqrt(energy / samples.length) * 230)));
      meterFrameRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }

  function playReference() {
    const audio = audioRef.current;
    if (!audio || !referenceReady) return;
    if (referenceStopRef.current) window.clearInterval(referenceStopRef.current);
    audio.pause();
    audio.currentTime = windowSeconds.start;
    void audio.play().catch(() => undefined);
    referenceStopRef.current = window.setInterval(() => {
      if (audio.currentTime >= windowSeconds.end) {
        audio.pause();
        if (referenceStopRef.current) window.clearInterval(referenceStopRef.current);
        referenceStopRef.current = null;
      }
    }, 40);
  }

  async function analyzeBlob(blob: Blob, duration: number) {
    setPhase("analyzing");
    try {
      const lesson = roundLesson(model.source.lesson, segment, roundIndex);
      const [metrics, transcriptionAttempt] = await Promise.all([
        analyzeAudioBlobDetailed(blob),
        requestTimestampedTranscription(blob, round.text),
      ]);
      const measuredMetrics = mergeServerAcoustics(metrics, transcriptionAttempt.transcription?.acoustics);
      const analysis = buildVoiceAnalysis(lesson, measuredMetrics, transcriptionAttempt.transcription, transcriptionAttempt.errorMessage);
      const result = evaluateEchoStudioRound(model, roundIndex, analysis);
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);
      const nextAttempt: EchoAttempt = {
        roundIndex,
        analysis,
        result,
        take: {
          id: crypto.randomUUID(),
          label: `Echo ${roundIndex + 1}`,
          url,
          blob,
          duration,
          createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        },
      };
      const nextAttempts = {
        ...attempts,
        [roundIndex]: nextAttempt,
      };
      setAttempts((current) => ({
        ...current,
        [roundIndex]: nextAttempt,
      }));
      const completed = result.passed && roundIndex === model.rounds.length - 1;
      if (completed) {
        const runId = Object.values(nextAttempts).map((attempt) => attempt.take.id).join(":");
        if (completedRunRef.current !== runId) {
          completedRunRef.current = runId;
          const scores = Object.values(nextAttempts)
            .map((attempt) => attempt.result.score)
            .filter((score): score is number => score !== null);
          onComplete({
            id: crypto.randomUUID(),
            lessonId: model.source.lesson.id,
            lessonTitle: `Echo Studio - ${model.source.lesson.title}`,
            score: Math.round(scores.reduce((total, score) => total + score, 0) / Math.max(1, scores.length)),
            xpEarned: model.source.lesson.xp,
            roundCount: model.rounds.length,
            analysis,
            createdAt: new Date().toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }
      }
      setPhase(completed ? "complete" : "result");
    } catch {
      setError("Impossible d'analyser cette replique. Recommence dans un endroit calme.");
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
      startedAtRef.current = Date.now();
      setRecordingTime(0);
      startMeter(stream);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const duration = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1_000 : 0;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopMeter();
        if (blob.size === 0 || duration < 0.5) {
          setError("Aucune voix claire n'a ete capturee. Reprends la replique.");
          setPhase("error");
          return;
        }
        void analyzeBlob(blob, duration);
      };
      recorder.start();
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) setRecordingTime((Date.now() - startedAtRef.current) / 1_000);
      }, 80);
    } catch {
      setError("Impossible d'ouvrir le micro. Verifie son autorisation dans Chrome.");
      setPhase("error");
    }
  }

  function startCountdown() {
    setError(null);
    setPhase("countdown");
    setCountdown(3);
    let next = 3;
    countdownRef.current = window.setInterval(() => {
      next -= 1;
      if (next <= 0) {
        if (countdownRef.current) window.clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(null);
        void beginRecording();
        return;
      }
      setCountdown(next);
    }, 760);
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function nextRound() {
    const next = Math.min(model.rounds.length - 1, roundIndex + 1);
    setRoundIndex(next);
    setPhase("listen");
    setError(null);
  }

  function retryRound() {
    setPhase("listen");
    setError(null);
  }

  function advanceGuide() {
    if (guideStep >= 2) {
      window.localStorage.setItem("voiceact-echo-studio-guide-v1", "seen");
      setGuideStep(3);
      return;
    }
    setGuideStep((current) => current + 1);
  }

  return (
    <section className="mx-auto w-full max-w-[1120px]" data-testid="echo-studio-game">
      {referencePath ? <audio ref={audioRef} preload="metadata" src={referencePath} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative overflow-hidden rounded-[30px] border border-[#A3E635]/20 bg-[#11101F] shadow-2xl shadow-black/25">
          <div className="diction-rush-grid absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">Echo Studio - imitation guidee</p>
                <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">{model.source.script.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#B9ACD7]">{model.source.script.objective}</p>
              </div>
              <div className="relative grid size-24 shrink-0 place-items-center rounded-[28px] border border-white/10 bg-white/5">
                <Image alt="Voxi guide Echo Studio" height={94} src="/voiceact/warmup/voxi-v2.png" width={94} />
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-white/10 bg-[#080711]/90 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#22D3EE]">Replique {roundIndex + 1}/{model.rounds.length}</p>
                  <h3 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{round.intention}</h3>
                </div>
                <button className="warmup-secondary-button" disabled={!referenceReady} onClick={playReference}>
                  Ecouter l&apos;exemple
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_210px]">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A3E635]">Phrase a imiter</p>
                  <p className="mt-3 text-xl font-black leading-snug text-white sm:text-2xl">{round.text}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[#171128] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FBBF24]">Repere voix</p>
                  <p className="mt-2 text-sm font-bold text-[#D8CCF4]">{round.targetWpm} MPM - {pauseLabel(round.pauseAfterMs)}</p>
                  <svg className="mt-4 h-14 w-full" viewBox="0 0 128 70" aria-hidden="true">
                    <path d={curvePath(segment.intonation)} fill="none" stroke="#A3E635" strokeLinecap="round" strokeWidth="7" />
                    <path d="M8 58 H120" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
                  </svg>
                  <p className="mt-1 text-xs font-bold text-[#9D8EC4]">{intonationLabel(segment.intonation)}</p>
                </div>
              </div>

              <div className="mt-5">
                <EchoPrompterLine
                  active={phase === "recording"}
                  segment={segment}
                  targetWpm={model.source.lesson.targetWpm}
                  timelineKey={`${roundIndex}-${phase}-${currentAttempt?.take.id ?? "new"}`}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">
                    {phase === "listen" ? "Ecoute puis imite" : phase === "recording" ? "A toi de jouer" : phase === "analyzing" ? "Comparaison en cours" : "Retour coach"}
                  </p>
                  {phase === "recording" ? <span className="font-mono text-sm font-black text-[#FDA4AF]">REC {formatDuration(recordingTime)}</span> : null}
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cx("h-full rounded-full transition-[width] duration-100", phase === "recording" ? "bg-[linear-gradient(90deg,#22D3EE,#A3E635,#FBBF24)]" : "bg-[#8B5CF6]")}
                    style={{ width: `${phase === "recording" ? Math.max(5, liveLevel) : Math.max(8, currentAttempt?.result.score ?? completedCount * 28)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-[#B9ACD7]">
                  {phase === "listen" ? "Commence par ecouter la reference. Ensuite rejoue seulement cette replique."
                    : phase === "recording" ? "La phrase defile vers la ligne rouge. Arrete quand tu as fini."
                      : currentAttempt?.result.priority ?? "VoiceAct compare ta prise avec la reference."}
                </p>
              </div>

              <div className={cx("grid place-items-center rounded-[24px] border border-white/10 p-4 text-center", scoreTone(currentAttempt?.result ?? null))}>
                {phase === "countdown" ? <span className="diction-countdown text-6xl font-black">{countdown}</span> : <>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Score replique</p>
                  <p className="mt-2 text-5xl font-black">{currentAttempt?.result.score ?? "--"}</p>
                </>}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {phase === "listen" || phase === "error" ? <button className="warmup-primary-button" disabled={!transcriptionReady || !referenceReady} onClick={startCountdown}>Enregistrer mon imitation</button> : null}
              {phase === "recording" ? <button className="warmup-primary-button bg-[#FB7185]" onClick={stopRecording}>Stop - {formatDuration(recordingTime)}</button> : null}
              {phase === "analyzing" ? <button className="warmup-primary-button" disabled>Analyse de la replique...</button> : null}
              {phase === "result" ? <button className="warmup-primary-button" onClick={retryRound}>Reprendre cette replique</button> : null}
              {phase === "result" && currentAttempt?.result.passed ? <button className="warmup-secondary-button" onClick={nextRound}>Replique suivante</button> : null}
              {phase === "complete" ? <button className="warmup-primary-button" onClick={() => { completedRunRef.current = null; setAttempts({}); setRoundIndex(0); setPhase("listen"); }}>Rejouer Echo Studio</button> : null}
            </div>
            {!transcriptionReady ? <p className="mt-4 text-sm font-bold text-[#FBBF24]">Le moteur vocal standard doit etre pret avant Echo Studio.</p> : null}
            {transcriptionReady && !advancedReady ? <p className="mt-4 rounded-2xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-3 text-sm font-bold text-[#FDE68A]">Analyse standard active : VoiceAct compare rythme, texte, energie et intonation. La precision phonemique avancee attend MFA.</p> : null}
            {!referenceReady ? <p className="mt-4 text-sm font-bold text-[#FBBF24]">Aucune reference audio controlee n&apos;est disponible pour cet exercice.</p> : null}
            {error ? <p className="mt-4 text-sm font-bold text-[#FDA4AF]">{error}</p> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[#161228] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">Progression</p>
            <p className="mt-3 text-4xl font-black">{completedCount}/{model.rounds.length}</p>
            <p className="mt-1 text-sm text-[#9D8EC4]">repliques validees</p>
            <div className="mt-4 space-y-2">
              {model.rounds.map((item, index) => {
                const attempt = attempts[index];
                const locked = index > 0 && !attempts[index - 1]?.result.passed;
                return (
                  <button
                    key={item.beatId}
                    className={cx(
                      "flex min-h-12 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-black transition",
                      index === roundIndex ? "bg-[#8B5CF6]/25 text-white ring-1 ring-[#8B5CF6]/45" : "bg-white/5 text-[#B9ACD7]",
                      locked && "cursor-not-allowed opacity-45",
                    )}
                    disabled={locked || phase === "recording" || phase === "countdown"}
                    onClick={() => { setRoundIndex(index); setPhase("listen"); }}
                  >
                    <span>Replique {index + 1}</span>
                    <span>{attempt?.result.passed ? "OK" : attempt?.result.score ?? "--"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#161228] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22D3EE]">Une correction</p>
            <p className="mt-3 text-sm leading-6 text-[#D8CCF4]">
              {currentAttempt?.result.priority ?? "Ecoute la reference, imite une seule replique, puis VoiceAct te donne la reprise prioritaire."}
            </p>
            {currentAttempt ? <audio className="mt-4 w-full" controls src={currentAttempt.take.url} /> : null}
          </div>
        </aside>
      </div>

      {isGuiding ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#080612]/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Decouverte Echo Studio">
        <div className="w-full max-w-[700px] overflow-hidden rounded-[32px] border border-[#A3E635]/30 bg-[#151126] shadow-[0_28px_100px_rgba(0,0,0,0.55)]">
          <div className="h-2 bg-white/10"><div className="h-full bg-[#A3E635] transition-all duration-500" style={{ width: `${((guideStep + 1) / 3) * 100}%` }} /></div>
          <div className="p-5 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[142px_minmax(0,1fr)] sm:items-center">
              <div className="relative mx-auto grid size-28 place-items-center rounded-[32px] border border-[#A3E635]/35 bg-[#110D23] sm:size-32">
                <Image alt="Voxi explique Echo Studio" height={118} src="/voiceact/warmup/voxi-v2.png" width={118} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">Etape {guideStep + 1} sur 3 - Voxi te guide</p>
                {guideStep === 0 ? <>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Tu commences par ecouter une voix modele.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Pas besoin de deviner l&apos;intention. La reference te montre le rythme, l&apos;energie et la courbe.</p>
                </> : null}
                {guideStep === 1 ? <>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Ensuite tu rejoues une seule replique.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Le texte defile vers la ligne rouge. Les mots violets se disent plus vite, les mots plus grands demandent plus d&apos;intensite.</p>
                </> : null}
                {guideStep === 2 ? <>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">VoiceAct corrige une priorite.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Si la replique passe, la suivante se debloque. Sinon, tu reprends seulement ce qui bloque.</p>
                </> : null}
                <button className="warmup-primary-button mt-6" onClick={advanceGuide}>{guideStep === 2 ? "Entrer dans Echo Studio" : "Compris, continuer"}</button>
              </div>
            </div>
          </div>
        </div>
      </div> : null}
    </section>
  );
}
