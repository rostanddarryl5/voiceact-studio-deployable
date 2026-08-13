"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeAudioBlobDetailed,
  formatDuration,
  getPreferredRecorderOptions,
  mergeServerAcoustics,
} from "@/lib/audio-analysis";
import { dictionRushDrills, type DictionRushDrill } from "@/lib/diction-rush";
import { assessDictionRushTargets, createDictionRushModel, didPassDictionRush } from "@/lib/phonetic-drill-model";
import {
  isPhonemeScoringReady,
  isTranscriptionUsable,
  requestTimestampedTranscription,
  type TranscriptionServiceStatus,
} from "@/lib/transcription-client";
import { buildVoiceAnalysis } from "@/lib/voice-engine";
import type { AnalysisResult, PhoneAssessment, VoiceTake } from "@/lib/types";

type RushPhase = "ready" | "countdown" | "recording" | "analyzing" | "result" | "error";

type RushAttempt = {
  drillId: string;
  analysis: AnalysisResult;
  take: VoiceTake;
  passed: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusClass(status: PhoneAssessment["status"] | "idle") {
  if (status === "good") return "border-[#A3E635]/60 bg-[#A3E635]/18 text-[#E4FF9A]";
  if (status === "fragile") return "border-[#FBBF24]/55 bg-[#FBBF24]/16 text-[#FDE68A]";
  if (status === "retry") return "border-[#FB7185]/60 bg-[#FB7185]/16 text-[#FDA4AF]";
  return "border-white/10 bg-white/5 text-[#B9ACD7]";
}

function resultLabel(analysis: AnalysisResult | null, drill: DictionRushDrill, targetScore: number | null, advancedReady: boolean) {
  if (!analysis) return "Prêt à jouer";
  if (analysis.analysisStatus === "no-speech") return "Aucune voix claire";
  if (!analysis.canValidate) return "Prise à refaire";
  if (!advancedReady) return "Entrainement mesure";
  return targetScore !== null && targetScore >= drill.passScore ? "Porte ouverte" : "Encore une prise";
}

function findTargetAssessment(analysis: AnalysisResult | null, target: string) {
  return (analysis?.pronunciation?.phones ?? [])
    .filter((phone) => phone.displayPhone === target || phone.phone === target)
    .sort((left, right) => (left.score ?? 101) - (right.score ?? 101))[0] ?? null;
}

function isUnlocked(index: number, attempts: Record<string, RushAttempt>) {
  if (index === 0) return true;
  return Boolean(attempts[dictionRushDrills[index - 1]?.id ?? ""]?.passed);
}

export default function DictionRushGame({ speechStatus }: { speechStatus: TranscriptionServiceStatus }) {
  const [drillIndex, setDrillIndex] = useState(0);
  const [phase, setPhase] = useState<RushPhase>("ready");
  const [guideStep, setGuideStep] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveLevel, setLiveLevel] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, RushAttempt>>({});
  const [currentAttempt, setCurrentAttempt] = useState<RushAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const levelAnimationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const drill = dictionRushDrills[drillIndex] ?? dictionRushDrills[0];
  const drillModel = useMemo(() => createDictionRushModel(drill.id), [drill.id]);
  const lesson = drillModel.lesson;
  const analysis = currentAttempt?.analysis ?? null;
  const validScores = Object.values(attempts).filter((attempt) => attempt.passed).length;
  const targetResult = useMemo(() => assessDictionRushTargets(drillModel, analysis), [analysis, drillModel]);
  const score = targetResult.score;
  const passed = targetResult.canPass;
  const transcriptionReady = isTranscriptionUsable(speechStatus);
  const advancedReady = isPhonemeScoringReady(speechStatus);
  const trainingScore = !advancedReady && analysis?.analysisStatus === "scored" ? analysis.globalScore : null;
  const nextIndex = Math.min(dictionRushDrills.length - 1, drillIndex + 1);
  const estimatedSeconds = Math.max(2.5, (drill.text.trim().split(/\s+/).length / drill.targetWpm) * 60);
  const isGuiding = guideStep < 3;

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    if (levelAnimationRef.current) window.cancelAnimationFrame(levelAnimationRef.current);
    audioContextRef.current?.close().catch(() => undefined);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function stopLiveMeter() {
    if (levelAnimationRef.current) {
      window.cancelAnimationFrame(levelAnimationRef.current);
      levelAnimationRef.current = null;
    }
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setLiveLevel(0);
  }

  function startLiveMeter(stream: MediaStream) {
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
      setLiveLevel(Math.min(100, Math.round(Math.sqrt(energy / samples.length) * 240)));
      levelAnimationRef.current = window.requestAnimationFrame(tick);
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
      const nextAttempt: RushAttempt = {
        drillId: drill.id,
        analysis: nextAnalysis,
        take: {
          id: crypto.randomUUID(), label: `Rush ${drillIndex + 1}`, url, blob, duration,
          createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        },
        passed: didPassDictionRush(drillModel, nextAnalysis),
      };
      setCurrentAttempt(nextAttempt);
      setAttempts((current) => ({ ...current, [drill.id]: nextAttempt }));
      setPhase("result");
    } catch {
      setError("La prise n'a pas pu être analysée. Recommence dans un endroit calme.");
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
      startLiveMeter(stream);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const duration = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1_000 : 0;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopLiveMeter();
        void analyzeBlob(blob, duration);
      };
      recorder.start();
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) setRecordingTime((Date.now() - startedAtRef.current) / 1_000);
      }, 120);
    } catch {
      setError("Impossible d'ouvrir le micro. Vérifie son autorisation dans le navigateur.");
      setPhase("error");
    }
  }

  function startCountdown() {
    setError(null);
    setCurrentAttempt(null);
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
    }, 780);
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function selectDrill(index: number) {
    if (!isUnlocked(index, attempts)) return;
    const nextDrill = dictionRushDrills[index];
    if (!nextDrill) return;
    setDrillIndex(index);
    setCurrentAttempt(attempts[nextDrill.id] ?? null);
    setPhase("ready");
    setError(null);
  }

  function retry() {
    setCurrentAttempt(null);
    setError(null);
    setPhase("ready");
  }

  function advanceGuide() {
    if (guideStep >= 2) {
      window.localStorage.setItem("voiceact-diction-rush-guide-v1", "seen");
      setGuideStep(3);
      return;
    }
    setGuideStep((current) => current + 1);
  }

  function restartGuide() {
    window.localStorage.removeItem("voiceact-diction-rush-guide-v1");
    setPhase("ready");
    setCurrentAttempt(null);
    setGuideStep(0);
  }

  return (
    <section className="mx-auto w-full max-w-[1180px]" data-testid="diction-rush-game">
      <div className={cx("grid gap-5", isGuiding ? "mx-auto max-w-[780px]" : "xl:grid-cols-[minmax(0,1fr)_318px]")}>
        <div className="relative overflow-hidden rounded-[30px] border border-[#22D3EE]/25 bg-[#10131F] shadow-2xl shadow-black/25">
          <div className="diction-rush-grid absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#22D3EE]">Jeu de précision · niveau {drill.level}</p>
                <h2 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">{drill.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#B9ACD7]">{drill.focus}</p>
                <div className={cx("mt-4 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em]", advancedReady ? "border-[#A3E635]/40 bg-[#A3E635]/12 text-[#D9F99D]" : transcriptionReady ? "border-[#FBBF24]/45 bg-[#FBBF24]/12 text-[#FDE68A]" : "border-[#FB7185]/40 bg-[#FB7185]/12 text-[#FDA4AF]")}>
                  {advancedReady ? "Mode officiel MFA : portes validantes" : transcriptionReady ? "Mode entrainement : pas de deblocage phonemique" : "Moteur vocal hors ligne"}
                </div>
              </div>
              <div className={cx("relative grid size-24 shrink-0 place-items-center rounded-[28px] border border-white/10 bg-white/5", phase === "recording" && "diction-voxi-listening")}>
                <Image alt="Voxi guide le défi de diction" height={94} src="/voiceact/warmup/voxi-v2.png" width={94} />
              </div>
            </div>

            <div className="mt-7 rounded-[28px] border border-white/10 bg-[#0A0D17]/85 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#A3E635]">Mission éclair</p>
                  <p className="mt-1 text-sm font-bold text-[#D8CCF4]">{drill.cue}</p>
                </div>
                <span className="rounded-full border border-[#A78BFA]/35 bg-[#8B5CF6]/15 px-3 py-1.5 text-xs font-black text-[#D8CCF4]">≈ {estimatedSeconds.toFixed(1)} s · {drill.targetWpm} MPM</span>
              </div>

              <div className="diction-rush-lane mt-6" data-phase={phase}>
                <div className="diction-rush-route" aria-hidden="true" />
                {drill.targetPhones.map((phone, index) => {
                  const assessment = findTargetAssessment(analysis, phone);
                  const status = assessment?.status ?? "idle";
                  return (
                    <div key={`${phone}-${index}`} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span className={cx("diction-rush-gate grid size-12 place-items-center rounded-2xl border text-base font-black transition sm:size-14", statusClass(status))}>
                        {index + 1}
                      </span>
                      <span className="text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#B9ACD7]">son cible</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 rounded-2xl bg-[#F8F6EF] px-4 py-4 text-xl font-black leading-snug text-[#14111F] sm:text-3xl">{drill.text}</p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22D3EE]">
                    {phase === "countdown" ? "À ton signal" : phase === "recording" ? "Voxi écoute" : phase === "analyzing" ? "Voxi compare" : "Une phrase, un objectif"}
                  </p>
                  {phase === "recording" ? <span className="font-mono text-sm font-black text-[#FDA4AF]">REC {formatDuration(recordingTime)}</span> : null}
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className={cx("h-full rounded-full transition-[width] duration-100", phase === "recording" ? "bg-[linear-gradient(90deg,#22D3EE,#A3E635,#FBBF24)]" : advancedReady ? "bg-[#8B5CF6]" : "bg-[linear-gradient(90deg,#22D3EE,#FBBF24)]")} style={{ width: `${phase === "recording" ? Math.max(5, liveLevel) : Math.max(8, score ?? trainingScore ?? 8)}%` }} />
                </div>
                <p className="mt-3 text-sm text-[#B9ACD7]">
                  {phase === "countdown" ? "Lis dès que le compte arrive à zéro." : phase === "recording" ? "Une voix claire suffit. Arrête dès la fin de la phrase." : advancedReady ? "Les portes se valident avec MFA après analyse de ta vraie prise." : "Sans MFA, Voxi te donne une correction d'entrainement sans debloquer la manche."}
                </p>
              </div>
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#171128] p-4 text-center">
                {phase === "countdown" ? <span className="diction-countdown text-6xl font-black text-[#A3E635]">{countdown}</span> : <>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A78BFA]">{resultLabel(analysis, drill, score, advancedReady)}</p>
                  <p className="mt-2 text-5xl font-black">{score ?? trainingScore ?? "--"}</p>
                  <p className="mt-1 text-xs text-[#9D8EC4]">{advancedReady ? `objectif ${drill.passScore}` : "score standard"}</p>
                </>}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {phase === "recording" ? <button className="warmup-primary-button bg-[#FB7185]" onClick={stopRecording}>Terminer · {formatDuration(recordingTime)}</button> : null}
              {phase === "ready" || phase === "error" ? <button className="warmup-primary-button" disabled={!transcriptionReady} onClick={startCountdown}>{advancedReady ? "Lancer le défi" : "S'entrainer sans MFA"}</button> : null}
              {phase === "analyzing" ? <button className="warmup-primary-button" disabled>{advancedReady ? "Analyse phonétique…" : "Analyse standard…"}</button> : null}
              {phase === "result" ? <button className="warmup-primary-button" onClick={retry}>{passed ? "Refaire pour progresser" : "Recommencer"}</button> : null}
              {phase === "result" && passed && drillIndex < dictionRushDrills.length - 1 ? <button className="warmup-secondary-button" onClick={() => selectDrill(nextIndex)}>Débloquer la manche suivante</button> : null}
            </div>
            {!transcriptionReady ? <p className="mt-4 text-sm font-bold text-[#FBBF24]">Le moteur vocal standard doit être prêt avant de lancer le défi.</p> : null}
            {transcriptionReady && !advancedReady ? <p className="mt-4 rounded-2xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-3 text-sm font-bold text-[#FDE68A]">MFA est indisponible : tu peux t&apos;entrainer, voir ton texte, ton rythme et ton energie, mais les portes phonemiques ne debloquent pas la suite.</p> : null}
            {phase === "ready" ? <button className="mt-5 text-xs font-bold text-[#9D8EC4] underline decoration-[#8B5CF6]/60 underline-offset-4" onClick={restartGuide}>Comment fonctionne Diction Rush ?</button> : null}
            {error ? <p className="mt-4 text-sm font-bold text-[#FDA4AF]">{error}</p> : null}
            {passed ? <p className="diction-success-pop mt-4 text-sm font-black text-[#A3E635]">Porte ouverte : cette manche est validée. La suivante est disponible.</p> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[#161228] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">Parcours</p>
            <p className="mt-3 text-4xl font-black">{validScores}/{dictionRushDrills.length}</p>
            <p className="mt-1 text-sm text-[#9D8EC4]">portes ouvertes</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {dictionRushDrills.map((item, index) => {
                const unlocked = isUnlocked(index, attempts);
                return <button key={item.id} aria-label={`Manche ${index + 1}`} className={cx("grid aspect-square place-items-center rounded-2xl text-xs font-black transition", index === drillIndex ? "ring-2 ring-[#22D3EE] bg-[#22D3EE] text-[#07111A]" : attempts[item.id]?.passed ? "bg-[#A3E635] text-[#0D0A1A]" : unlocked ? "bg-white/10 text-[#B9ACD7] hover:bg-white/15" : "cursor-not-allowed bg-white/[0.035] text-[#5E5574]")} disabled={!unlocked || phase === "recording" || phase === "countdown"} onClick={() => selectDrill(index)}>{unlocked ? index + 1 : "·"}</button>;
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#161228] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22D3EE]">Retour précis</p>
            {advancedReady && analysis?.pronunciation?.phones.length ? <div className="mt-3 flex flex-wrap gap-2">{drill.targetPhones.map((phone, index) => {
              const assessment = findTargetAssessment(analysis, phone);
              return <span key={`${phone}-feedback-${index}`} className={cx("rounded-full border px-3 py-1 text-xs font-black", statusClass(assessment?.status ?? "idle"))}>porte {index + 1}{assessment?.score !== null && assessment?.score !== undefined ? ` · ${assessment.score}` : ""}</span>;
            })}</div> : <p className="mt-3 text-sm leading-6 text-[#9D8EC4]">{advancedReady ? "Après la prise, VoiceAct te montre les sons qui sont solides et celui à reprendre." : "Mode entrainement : travaille surtout la fidelite du texte, le rythme et l'energie avant la notation phonemique."}</p>}
            {targetResult.priority ? <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-[#D8CCF4]">{targetResult.priority}</p> : analysis?.advice ? <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-[#D8CCF4]">{analysis.advice}</p> : null}
            {currentAttempt ? <audio className="mt-4 w-full" controls src={currentAttempt.take.url} /> : null}
          </div>
        </aside>
      </div>
      {isGuiding ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#080612]/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Découverte de Diction Rush">
        <div className="w-full max-w-[700px] overflow-hidden rounded-[32px] border border-[#A3E635]/30 bg-[#151126] shadow-[0_28px_100px_rgba(0,0,0,0.55)]">
          <div className="h-2 bg-white/10"><div className="h-full bg-[#A3E635] transition-all duration-500" style={{ width: `${((guideStep + 1) / 3) * 100}%` }} /></div>
          <div className="p-5 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[142px_minmax(0,1fr)] sm:items-center">
              <div className="relative mx-auto grid size-28 place-items-center rounded-[32px] border border-[#A3E635]/35 bg-[#110D23] sm:size-32">
                <Image alt="Voxi explique le jeu" height={118} src="/voiceact/warmup/voxi-v2.png" width={118} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">Étape {guideStep + 1} sur 3 · Voxi te guide</p>
                {guideStep === 0 ? <>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Tu vas entraîner ta diction, sans deviner quoi faire.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Ici, tu lis une seule phrase courte. VoiceAct écoute ensuite les sons importants et te donne une priorité simple pour progresser.</p>
                </> : null}
                {guideStep === 1 ? <>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Les portes sont les sons que VoiceAct écoute.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Après ta prise, une porte verte est solide. Jaune ou rose signifie seulement : voici le son à retravailler en premier.</p>
                </> : null}
                {guideStep === 2 ? <>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Dans un instant : compte à rebours, phrase, puis stop.</h3>
                  <p className="mt-3 text-base leading-7 text-[#D8CCF4]">Lis naturellement dès que le compte arrive à zéro. Quand la phrase est finie, appuie sur « Terminer ». Voxi s&apos;occupe du reste.</p>
                </> : null}
                <button className="warmup-primary-button mt-6" onClick={advanceGuide}>{guideStep === 2 ? "Je suis prêt" : "Compris, continuer"}</button>
              </div>
            </div>
          </div>
        </div>
      </div> : null}
    </section>
  );
}
