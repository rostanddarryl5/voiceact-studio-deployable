"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ArticulationLabGame from "@/components/ArticulationLabGame";
import DictionRushGame from "@/components/DictionRushGame";
import EchoStudioGame, { type EchoStudioCompletion } from "@/components/EchoStudioGame";
import VoiceWarmupGame, { type WarmupDailyResult } from "@/components/VoiceWarmupGame";
import {
  analyzeAudioBlobDetailed,
  formatDuration,
  getPreferredRecorderOptions,
  mergeServerAcoustics,
} from "@/lib/audio-analysis";
import {
  appSections,
  buildDimensions,
  getAdaptiveLessonRecommendation,
  getBestDimension,
  getLessonsForGoal,
  getLessonTone,
  getScoreGrade,
  getWeakestDimension,
  isLessonUnlocked,
  lessonFilters,
  PASS_SCORE,
  type AdaptiveLessonRecommendation,
  type AppSection,
  type VoiceDimension,
} from "@/lib/curriculum";
import { loadVoiceAttempt, saveVoiceAttempt } from "@/lib/attempt-storage";
import { createDiagnosticBaseline } from "@/lib/diagnostic-exercise-model";
import { lessons } from "@/lib/lessons";
import {
  buildPromptWordTimings,
  curvePath,
  intonationLabel,
  pauseLabel,
  prompterMotionPixelsPerMs,
  prompterRateLabel,
  resolveSegmentSpeechDurationMs,
} from "@/lib/prosody";
import {
  isTranscriptionUsable,
  requestTimestampedTranscription,
  requestTranscriptionServiceStatus,
  type TranscriptionServiceStatus,
} from "@/lib/transcription-client";
import { buildVoiceAnalysis } from "@/lib/voice-engine";
import type {
  AnalysisResult,
  BaselineRecord,
  Lesson,
  OnboardingProfile,
  PracticeHistoryEntry,
  VoiceSpecialty,
  VoiceTake,
} from "@/lib/types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type AttemptComparison = {
  lessonTitle: string;
  previousScore: number;
  currentScore: number;
  delta: number;
};

function voiceVolumeLabel(energy: Lesson["segments"][number]["energy"]) {
  switch (energy) {
    case "low":
      return "Volume bas";
    case "high":
      return "Volume fort";
    case "contained":
      return "Volume contenu";
    default:
      return "Volume moyen";
  }
}

function onboardingOptionLabel(value: string) {
  const labels: Record<string, string> = {
    "Createur video": "Créateur vidéo",
    "Doublage cinema": "Doublage cinéma",
    Debutant: "Débutant",
    Intermediaire: "Intermédiaire",
    Avance: "Avancé",
    Femme: "Femme",
    Homme: "Homme",
    "Prefere ne pas dire": "Je préfère ne pas le dire",
    Feminine: "Voix féminines",
    Masculine: "Voix masculines",
    Alternee: "Alterner les deux",
  };
  const specialtyLabels: Record<string, string> = {
    "Short dynamique": "Shorts, Reels et TikTok",
    "Video longue storytelling": "Vidéo longue et storytelling",
    "Actualite journalisme": "Actualité et journalisme",
    "Horreur suspense": "Horreur et suspense",
    "Publicite UGC": "Publicité et UGC",
    "Film serie": "Films et séries",
    "Animation dessin anime": "Animation et dessin animé",
    "Jeu video": "Jeu vidéo",
  };
  return specialtyLabels[value] ?? labels[value] ?? value;
}

function onboardingOptionHint(value: string) {
  const hints: Record<string, string> = {
    "Createur video": "Hooks, narration et rétention",
    "Doublage cinema": "Jeu, synchronisation et émotions",
    "Short dynamique": "Rapide, dense et accrocheur",
    "Video longue storytelling": "Rythme narratif et progression",
    "Actualite journalisme": "Clarté, crédibilité et relances",
    "Horreur suspense": "Tension, silences et révélation",
    "Publicite UGC": "Impact, naturel et conversion",
    "Film serie": "Sous-texte et jeu réaliste",
    "Animation dessin anime": "Personnages et grande expressivité",
    "Jeu video": "Effort, répliques et variations",
    Femme: "Pour calibrer les plages acoustiques",
    Homme: "Pour calibrer les plages acoustiques",
    "Prefere ne pas dire": "VoiceAct utilisera ta propre voix comme référence",
    Feminine: "Exemples joués par des voix féminines",
    Masculine: "Exemples joués par des voix masculines",
    Alternee: "Pour travailler avec plusieurs timbres",
  };
  return hints[value];
}

function voiceSizeClass(energy: Lesson["segments"][number]["energy"]) {
  switch (energy) {
    case "low":
      return "text-2xl sm:text-3xl";
    case "high":
      return "text-4xl sm:text-6xl";
    case "contained":
      return "text-3xl sm:text-5xl";
    default:
      return "text-3xl sm:text-4xl";
  }
}

function promptPhraseSizeClass(energy: Lesson["segments"][number]["energy"]) {
  switch (energy) {
    case "low":
      return "text-[15px] sm:text-base";
    case "high":
      return "text-xl sm:text-2xl";
    case "contained":
      return "text-base sm:text-lg";
    default:
      return "text-[17px] sm:text-xl";
  }
}

function promptWordSizeClass(sizeCue: "soft" | "normal" | "strong") {
  if (sizeCue === "strong") return "text-[1.2em]";
  if (sizeCue === "soft") return "text-[0.82em] font-bold opacity-80";
  return "text-[1em]";
}

function segmentReadDurationMs(segment: Lesson["segments"][number], targetWpm: number) {
  return resolveSegmentSpeechDurationMs(segment, targetWpm);
}

function promptPitchOffset(intonation: Lesson["segments"][number]["intonation"]) {
  switch (intonation) {
    case "rise":
    case "build":
      return -5;
    case "fall":
      return 5;
    case "rise_fall":
      return -2;
    default:
      return 1;
  }
}

function segmentGuideDurationMs(segment: Lesson["segments"][number], targetWpm: number) {
  return segmentReadDurationMs(segment, targetWpm) + segment.pauseAfterMs;
}

function SmoothPrompterStrip({
  children,
  isRecording,
  pixelsPerMs,
  timelineKey,
  totalDurationMs,
}: {
  children: ReactNode;
  isRecording: boolean;
  pixelsPerMs: number;
  timelineKey: string;
  totalDurationMs: number;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transform = "translate3d(0, -50%, 0)";
    if (!isRecording) return;

    const stripBounds = strip.getBoundingClientRect();
    const anchors = Array.from(strip.querySelectorAll<HTMLElement>("[data-prompt-time-ms]"))
      .map((element) => ({
        timeMs: Number(element.dataset.promptTimeMs),
        x: element.getBoundingClientRect().left - stripBounds.left,
      }))
      .filter((anchor) => Number.isFinite(anchor.timeMs) && Number.isFinite(anchor.x))
      .sort((a, b) => a.timeMs - b.timeMs);

    const startedAt = performance.now();
    let animationFrame = 0;
    let anchorIndex = 0;
    const renderFrame = (now: number) => {
      const elapsedMs = Math.min(totalDurationMs, now - startedAt);
      while (anchorIndex < anchors.length - 2 && anchors[anchorIndex + 1].timeMs <= elapsedMs) {
        anchorIndex += 1;
      }
      const previous = anchors[anchorIndex];
      const next = anchors[Math.min(anchorIndex + 1, anchors.length - 1)];
      const anchoredX = previous && next
        ? previous.x + (next.x - previous.x) * Math.max(0, Math.min(1, (elapsedMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs)))
        : elapsedMs * pixelsPerMs;
      strip.style.transform = `translate3d(-${anchoredX}px, -50%, 0)`;
      if (elapsedMs < totalDurationMs) animationFrame = window.requestAnimationFrame(renderFrame);
    };
    animationFrame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isRecording, pixelsPerMs, timelineKey, totalDurationMs]);

  return (
    <div
      ref={stripRef}
      className="absolute left-[9%] top-1/2 flex w-max items-stretch gap-0 whitespace-nowrap pr-[78vw] will-change-transform"
      data-testid="prompter-strip"
    >
      {children}
    </div>
  );
}

function Waveform({ level, active = false }: { level: number; active?: boolean }) {
  const bars = Array.from({ length: 28 }, (_, index) => {
    const wave = Math.sin(index * 0.72) * 18 + Math.cos(index * 0.29) * 12;
    const liveBoost = active ? level * (0.25 + (index % 5) * 0.06) : 10;
    return Math.max(12, Math.min(86, 26 + wave + liveBoost));
  });

  return (
    <div className="flex min-h-24 items-center justify-center gap-1.5 overflow-hidden rounded-[28px] border border-white/10 bg-[#0D0A1A]/70 px-4">
      {bars.map((height, index) => (
        <span
          key={index}
          className={cx(
            "w-1.5 rounded-full transition-all duration-150",
            active ? "bg-[#A3E635] shadow-[0_0_18px_rgba(163,230,53,0.55)]" : "bg-[#8B5CF6]/70",
          )}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const duration = 950;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setAnimatedScore(Math.round(safeScore * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [safeScore]);

  return (
    <div className="voiceact-score-gauge relative grid size-48 place-items-center">
      <div className="voiceact-score-aura absolute inset-5 rounded-full bg-[#A3E635]/15 blur-2xl" />
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 192 192" aria-hidden="true">
        <defs>
          <linearGradient id="voiceact-score-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D9FF73" />
            <stop offset="52%" stopColor="#A3E635" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle cx="96" cy="96" r="76" fill="none" stroke="rgba(240,235,255,0.09)" strokeWidth="13" />
        <circle
          className="transition-[stroke-dashoffset] duration-100 ease-out"
          cx="96"
          cy="96"
          r="76"
          fill="none"
          pathLength="100"
          stroke="url(#voiceact-score-gradient)"
          strokeDasharray="100"
          strokeDashoffset={100 - animatedScore}
          strokeLinecap="round"
          strokeWidth="13"
        />
      </svg>
      <span className="voiceact-score-orbit absolute size-3 rounded-full bg-white shadow-[0_0_16px_5px_rgba(163,230,53,0.7)]" />
      <div className="relative grid size-32 place-items-center rounded-full border border-white/10 bg-[#100C20]/95 text-center shadow-[inset_0_0_32px_rgba(139,92,246,0.14)]">
        <div>
          <span className="block text-5xl font-black leading-none text-white">{animatedScore}</span>
          <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.26em] text-[#A3E635]">sur 100</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [section, setSection] = useState<AppSection>("diagnostic");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveLevel, setLiveLevel] = useState(0);
  const [takes, setTakes] = useState<VoiceTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lessonScores, setLessonScores] = useState<Record<string, number>>({});
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryEntry[]>([]);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [baseline, setBaseline] = useState<BaselineRecord | null>(null);
  const [recommendedLessonId, setRecommendedLessonId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AttemptComparison | null>(null);
  const [baselineAudioUrl, setBaselineAudioUrl] = useState<string | null>(null);
  const [speechStatus, setSpeechStatus] = useState<TranscriptionServiceStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [warmupResult, setWarmupResult] = useState<WarmupDailyResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const levelAnimationRef = useRef<number | null>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const progressLoadedRef = useRef(false);

  const lesson = lessons[lessonIndex];
  const activeTake = takes.find((take) => take.id === activeTakeId) ?? takes[0] ?? null;
  const nextLevelXp = 200;
  const levelProgress = Math.min(100, Math.round((totalXp / nextLevelXp) * 100));
  const dimensions = buildDimensions(analysis);
  const hasValidatedDiagnostic = baseline !== null;
  const visibleSections = hasValidatedDiagnostic
    ? appSections
    : appSections.filter((item) => item.id === "diagnostic");
  const trackLessons = getLessonsForGoal(profile?.goal, profile?.specialty);
  const filteredLessons = trackLessons.filter(
    (item) => activeFilter === "Tous" || item.domain === activeFilter || item.category === activeFilter,
  );

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (levelAnimationRef.current) window.cancelAnimationFrame(levelAnimationRef.current);
      liveAudioContextRef.current?.close().catch(() => undefined);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      if (!progressLoadedRef.current) {
        progressLoadedRef.current = true;
        setIsProgressLoaded(true);
      }
    }, 1800);

    window.setTimeout(() => {
      try {
        const savedProgress = window.localStorage.getItem("voiceact-progress");
        if (savedProgress) {
          try {
            const parsed = JSON.parse(savedProgress) as {
              version?: number;
              totalXp?: number;
              streak?: number;
              lessonScores?: Record<string, number>;
              practiceHistory?: PracticeHistoryEntry[];
              profile?: OnboardingProfile;
              baseline?: BaselineRecord;
              recommendedLessonId?: string;
              warmupResult?: WarmupDailyResult;
            };
            const cleanedHistory = Array.isArray(parsed.practiceHistory)
              ? parsed.practiceHistory.filter((entry) => entry.analysisMode !== "local-only")
              : [];
            const hasRealProgress = cleanedHistory.length > 0
              || Boolean(parsed.baseline?.attemptId)
              || Boolean(parsed.lessonScores && Object.keys(parsed.lessonScores).length);
            if (typeof parsed.totalXp === "number") setTotalXp(parsed.version && parsed.version >= 3 ? parsed.totalXp : hasRealProgress ? parsed.totalXp : 0);
            if (typeof parsed.streak === "number") setStreak(parsed.version && parsed.version >= 3 ? parsed.streak : hasRealProgress ? parsed.streak : 0);
            if (parsed.lessonScores && typeof parsed.lessonScores === "object") setLessonScores(parsed.lessonScores);
            setPracticeHistory(cleanedHistory);
            if (parsed.profile?.goal) setProfile(parsed.profile);
            if (parsed.baseline?.attemptId) setBaseline(parsed.baseline);
            if (typeof parsed.recommendedLessonId === "string") setRecommendedLessonId(parsed.recommendedLessonId);
            if (parsed.warmupResult?.date) setWarmupResult(parsed.warmupResult);
          } catch {
            window.localStorage.removeItem("voiceact-progress");
          }
        }
      } catch {
        // Some public-preview browsers or privacy settings can block storage access.
        // VoiceAct must still open and guide the tester instead of staying on the splash screen.
      } finally {
        window.clearTimeout(fallbackTimer);
        progressLoadedRef.current = true;
        setIsProgressLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    if (!isProgressLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("warmup") !== "1") return;
    const timer = window.setTimeout(() => setSection("warmup"), 0);
    return () => window.clearTimeout(timer);
  }, [isProgressLoaded]);

  useEffect(() => {
    if (!isProgressLoaded) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isProgressLoaded, section]);

  useEffect(() => {
    if (!progressLoadedRef.current) return;
    window.localStorage.setItem("voiceact-progress", JSON.stringify({
      version: 4,
      totalXp,
      streak,
      lessonScores,
      practiceHistory,
      profile,
      baseline,
      recommendedLessonId,
      warmupResult,
    }));
  }, [baseline, lessonScores, practiceHistory, profile, recommendedLessonId, streak, totalXp, warmupResult]);

  useEffect(() => {
    if (!baseline?.audioStored) return;

    let cancelled = false;
    loadVoiceAttempt(baseline.attemptId)
      .then((attempt) => {
        if (cancelled || !attempt) return;
        const url = URL.createObjectURL(attempt.blob);
        objectUrlsRef.current.push(url);
        setBaselineAudioUrl(url);
      })
      .catch(() => setBaselineAudioUrl(null));
    return () => {
      cancelled = true;
    };
  }, [baseline]);

  useEffect(() => {
    requestTranscriptionServiceStatus().then(setSpeechStatus);
  }, []);

  function stopLiveLevelMeter() {
    if (levelAnimationRef.current) {
      window.cancelAnimationFrame(levelAnimationRef.current);
      levelAnimationRef.current = null;
    }

    liveAudioContextRef.current?.close().catch(() => undefined);
    liveAudioContextRef.current = null;
    setLiveLevel(0);
  }

  function startLiveLevelMeter(stream: MediaStream) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 512;
    const samples = new Uint8Array(analyser.fftSize);

    source.connect(analyser);
    liveAudioContextRef.current = audioContext;

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sumSquares = 0;

      for (let index = 0; index < samples.length; index += 1) {
        const normalized = ((samples[index] ?? 128) - 128) / 128;
        sumSquares += normalized * normalized;
      }

      setLiveLevel(Math.min(100, Math.round(Math.sqrt(sumSquares / samples.length) * 220)));
      levelAnimationRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  }

  async function startRecording() {
    setError(null);
    setAnalysis(null);
    setLiveLevel(0);
    setSection("session");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ton navigateur ne permet pas l'enregistrement micro.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, getPreferredRecorderOptions());

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      startLiveLevelMeter(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("L'enregistrement a echoue. Verifie le micro choisi dans Chrome.");
        setIsRecording(false);
        stopLiveLevelMeter();
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onstop = () => {
        const duration = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : recordingTime;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopLiveLevelMeter();

        if (blob.size === 0 || duration < 0.5) {
          setError("Aucune voix n'a ete capturee. Parle au moins une seconde, puis reessaie.");
          setRecordingTime(0);
          setIsRecording(false);
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        const nextTake: VoiceTake = {
          id: crypto.randomUUID(),
          label: `Prise ${takes.length + 1}`,
          url,
          blob,
          duration,
          createdAt: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        };

        setTakes((current) => [nextTake, ...current]);
        setActiveTakeId(nextTake.id);
        setRecordingTime(0);
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) setRecordingTime((Date.now() - startedAtRef.current) / 1000);
      }, 50);
    } catch (recordingError) {
      const message =
        recordingError instanceof DOMException && recordingError.name === "NotAllowedError"
          ? "Chrome bloque le micro. Clique sur l'icone a gauche de l'adresse et autorise le micro."
          : "Impossible d'acceder au micro. Verifie que ton micro est branche et autorise.";
      setError(message);
      setIsRecording(false);
      stopLiveLevelMeter();
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else {
      setIsRecording(false);
      stopLiveLevelMeter();
    }
  }

  async function analyzeTake() {
    if (!activeTake) {
      setError("Enregistre une prise avant de lancer l'analyse.");
      setSection("session");
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setSpeechStatus("checking");

      const [metrics, transcriptionAttempt] = await Promise.all([
        analyzeAudioBlobDetailed(activeTake.blob),
        requestTimestampedTranscription(activeTake.blob, lesson.segments.map((segment) => segment.text).join(" ")),
      ]);
      const measuredMetrics = mergeServerAcoustics(metrics, transcriptionAttempt.transcription?.acoustics);
      const nextAnalysis = buildVoiceAnalysis(
        lesson,
        measuredMetrics,
        transcriptionAttempt.transcription,
        transcriptionAttempt.errorMessage,
      );
      setSpeechStatus(transcriptionAttempt.transcription ? "standard" : "offline");

      const attemptId = crypto.randomUUID();
      const createdAtIso = new Date().toISOString();
      let audioStored = false;
      if (nextAnalysis.analysisStatus === "scored") {
        try {
          await saveVoiceAttempt({
            id: attemptId,
            lessonId: lesson.id,
            createdAt: createdAtIso,
            blob: activeTake.blob,
            analysis: nextAnalysis,
          });
          audioStored = true;
        } catch {
          audioStored = false;
        }
      }

      const adaptiveRecommendation = nextAnalysis.analysisStatus === "scored" && (nextAnalysis.canValidate || lesson.category === "Diagnostic")
        ? getAdaptiveLessonRecommendation(nextAnalysis, profile, lessonScores, lesson.id)
        : null;
      const previousAttempt = practiceHistory.find(
        (entry) => entry.lessonId === lesson.id && entry.canValidate !== false,
      );
      setComparison(nextAnalysis.analysisStatus === "scored" && previousAttempt
        ? {
            lessonTitle: lesson.title,
            previousScore: previousAttempt.score,
            currentScore: nextAnalysis.globalScore,
            delta: nextAnalysis.globalScore - previousAttempt.score,
          }
        : null);

      setAnalysis(nextAnalysis);
      if (nextAnalysis.analysisStatus === "scored") {
        setPracticeHistory((current) =>
          [
            {
              id: attemptId,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              score: nextAnalysis.globalScore,
              badge: nextAnalysis.badge,
              wpm: nextAnalysis.wpm,
              targetWpm: nextAnalysis.targetWpm,
              pauseCount: nextAnalysis.pauseCount,
              expectedPauses: nextAnalysis.expectedPauses,
              silencePercent: nextAnalysis.silencePercent,
              energyVariationPercent: nextAnalysis.energyVariationPercent,
              dimensionScores: nextAnalysis.dimensionScores,
              analysisMode: nextAnalysis.analysisMode,
              canValidate: nextAnalysis.canValidate,
              confidence: nextAnalysis.confidence,
              audioAttemptId: audioStored ? attemptId : undefined,
              recommendedLessonId: adaptiveRecommendation?.lessonId,
              createdAt: new Date().toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            ...current,
          ].slice(0, 30),
        );
      }
      if (lesson.category === "Diagnostic" && !baseline) {
        const diagnosticBaseline = createDiagnosticBaseline(nextAnalysis, { attemptId, createdAt: createdAtIso, audioStored });
        if (diagnosticBaseline) {
          setBaseline(diagnosticBaseline);
          if (adaptiveRecommendation) setRecommendedLessonId(adaptiveRecommendation.lessonId);
          setLessonScores((current) => ({
            ...current,
            [lesson.id]: Math.max(current[lesson.id] ?? 0, nextAnalysis.globalScore),
          }));
        }
      }

      if (nextAnalysis.canValidate) {
        setLessonScores((current) => ({
          ...current,
          [lesson.id]: Math.max(current[lesson.id] ?? 0, nextAnalysis.globalScore),
        }));
        if (adaptiveRecommendation) setRecommendedLessonId(adaptiveRecommendation.lessonId);
        setTotalXp((current) => Math.min(nextLevelXp, current + nextAnalysis.xpEarned));
        if (lesson.category !== "Diagnostic" && nextAnalysis.globalScore >= PASS_SCORE) {
          setStreak((current) => current + 1);
        }
      }
      setSection("results");
    } catch {
      setError("Impossible d'analyser cette prise. Reessaie avec un nouvel enregistrement.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleEchoStudioComplete(completion: EchoStudioCompletion) {
    setAnalysis(completion.analysis);
    setLessonScores((current) => ({
      ...current,
      [completion.lessonId]: Math.max(current[completion.lessonId] ?? 0, completion.score),
    }));
    setPracticeHistory((current) =>
      [
        {
          id: completion.id,
          lessonId: completion.lessonId,
          lessonTitle: completion.lessonTitle,
          score: completion.score,
          badge: "Echo valide",
          wpm: completion.analysis.wpm,
          targetWpm: completion.analysis.targetWpm,
          pauseCount: completion.analysis.pauseCount,
          expectedPauses: completion.analysis.expectedPauses,
          silencePercent: completion.analysis.silencePercent,
          energyVariationPercent: completion.analysis.energyVariationPercent,
          dimensionScores: completion.analysis.dimensionScores,
          analysisMode: completion.analysis.analysisMode,
          canValidate: true,
          confidence: completion.analysis.confidence,
          createdAt: completion.createdAt,
        },
        ...current,
      ].slice(0, 30),
    );
    setTotalXp((current) => Math.min(nextLevelXp, current + completion.xpEarned));
    setStreak((current) => current + 1);
  }

  function selectLesson(index: number, nextSection: AppSection = "session") {
    if (!isLessonUnlocked(index, lessonScores, {
      diagnosticCompleted: hasValidatedDiagnostic,
      recommendedLessonId,
      goal: profile?.goal,
      specialty: profile?.specialty,
    })) {
      setError(`Exercice verrouille : valide l'exercice precedent avec au moins ${PASS_SCORE}/100.`);
      setSection("exercises");
      return;
    }
    setLessonIndex(index);
    setAnalysis(null);
    setTakes([]);
    setActiveTakeId(null);
    setSection(nextSection);
  }

  if (!isProgressLoaded) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0D0A1A] px-6 text-[#F0EBFF]">
        <div className="text-center">
          <div className="voiceact-mascot relative mx-auto grid size-24 place-items-center rounded-[32px] bg-[#161228] shadow-[0_0_38px_rgba(139,92,246,0.35)]">
            <span className="grid size-16 place-items-center rounded-full bg-[#A3E635] text-xl font-black text-[#0D0A1A]">VA</span>
            <span className="voiceact-mascot-ping" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">VoiceAct prépare ta session</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0D0A1A] text-[#F0EBFF]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.28),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(244,114,182,0.14),transparent_34%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px]">
        <aside className={cx(
          "sticky top-0 h-screen w-72 shrink-0 border-r border-white/10 bg-[#161228]/90 p-5 backdrop-blur-xl",
          hasValidatedDiagnostic ? "hidden lg:block" : "hidden",
        )}>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#8B5CF6] shadow-[0_0_32px_rgba(139,92,246,0.45)]">
              <span className="text-lg font-black">VA</span>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#A3E635]">VoiceAct</p>
              <p className="text-lg font-black">Studio vocal</p>
            </div>
          </div>

          <nav className="mt-9 space-y-2">
            {visibleSections.map((item) => (
              <button
                key={item.id}
                className={cx(
                  "flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-sm font-bold transition",
                  section === item.id
                    ? "bg-[#8B5CF6]/20 text-white ring-1 ring-[#8B5CF6]/45"
                    : "text-[#9D8EC4] hover:bg-white/5 hover:text-white",
                )}
                onClick={() => setSection(item.id)}
              >
                {item.label}
                {section === item.id ? <span className="size-2 rounded-full bg-[#A3E635]" /> : null}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-5 left-5 right-5 rounded-[28px] border border-white/10 bg-[#1E1835] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9D8EC4]">Niveau 1</p>
                <p className="font-black">{totalXp}/{nextLevelXp} XP</p>
              </div>
              <div className="rounded-2xl bg-[#0D0A1A] px-3 py-2 text-right">
                <p className="text-[10px] font-black uppercase text-[#FBBF24]">Streak</p>
                <p className="font-black">{streak} j</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#A3E635]" style={{ width: `${levelProgress}%` }} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 pb-8">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0D0A1A]/88 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#A3E635]">VoiceAct</p>
                <h1 className="max-w-[58vw] break-words text-2xl font-black leading-tight tracking-tight sm:max-w-none sm:text-3xl">
                  {section === "diagnostic" && "Diagnostic initial"}
                  {section === "dashboard" && "Tableau de bord"}
                  {section === "exercises" && "Bibliotheque d'exercices"}
                  {section === "warmup" && "Échauffement vocal"}
                  {section === "diction" && "Diction Rush"}
                  {section === "articulation" && "Articulation Lab"}
                  {section === "echo" && "Echo Studio"}
                  {section === "session" && "Studio vocal"}
                  {section === "results" && "Resultats IA"}
                  {section === "progress" && "Progression"}
                  {section === "badges" && "Badges"}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasValidatedDiagnostic ? <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right sm:block">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FBBF24]">Streak</p>
                  <p className="font-black">{streak} jours</p>
                </div> : null}
                {hasValidatedDiagnostic ? <button
                  className="rounded-2xl bg-[#A3E635] px-4 py-3 text-sm font-black text-[#0D0A1A] shadow-[0_0_24px_rgba(163,230,53,0.25)]"
                  onClick={() => setSection(hasValidatedDiagnostic ? "warmup" : "diagnostic")}
                >
                  Pratiquer
                </button> : null}
              </div>
            </div>
          </header>

          {hasValidatedDiagnostic ? (
            <nav className="border-b border-white/10 bg-[#0D0A1A]/70 px-4 py-3 lg:hidden" aria-label="Navigation VoiceAct mobile">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {visibleSections.map((item) => (
                  <button
                    key={item.id}
                    className={cx(
                      "min-h-11 shrink-0 rounded-2xl px-4 text-xs font-black transition",
                      section === item.id ? "bg-[#8B5CF6] text-white shadow-[0_0_18px_rgba(139,92,246,0.28)]" : "border border-white/10 bg-white/5 text-[#B7A9DA]",
                    )}
                    onClick={() => setSection(item.id)}
                  >
                    {item.short}
                  </button>
                ))}
              </div>
            </nav>
          ) : null}

          <div className="px-4 py-5 sm:px-6 lg:px-8">
            {section === "diagnostic" ? (
              <Diagnostic
                key={profile?.completedAt ?? "new-profile"}
                baseline={baseline}
                baselineAudioUrl={baselineAudioUrl}
                profile={profile}
                onOpenCursus={() => setSection("exercises")}
                onStartCourse={() => {
                  const recommendedIndex = lessons.findIndex((item) => item.id === recommendedLessonId);
                  const firstTrackLesson = getLessonsForGoal(profile?.goal, profile?.specialty).find((item) => item.category !== "Diagnostic");
                  const fallbackIndex = lessons.findIndex((item) => item.id === firstTrackLesson?.id);
                  selectLesson(recommendedIndex > 0 ? recommendedIndex : Math.max(1, fallbackIndex), "session");
                }}
                onStartDiagnostic={(nextProfile) => {
                  if (nextProfile) setProfile(nextProfile);
                  selectLesson(0, "session");
                }}
              />
            ) : null}

            {section === "dashboard" ? (
              <Dashboard
                analysis={analysis}
                dimensions={dimensions}
                lesson={lesson}
                levelProgress={levelProgress}
                onPractice={() => setSection("session")}
                onWarmup={() => setSection("warmup")}
                onDictionRush={() => setSection("diction")}
                onArticulationLab={() => setSection("articulation")}
                onEchoStudio={() => setSection("echo")}
                onSelectLesson={selectLesson}
                streak={streak}
                totalXp={totalXp}
                warmupResult={warmupResult}
              />
            ) : null}

            {section === "warmup" ? (
              <VoiceWarmupGame
                previousResult={warmupResult}
                onComplete={setWarmupResult}
                onContinue={() => setSection(hasValidatedDiagnostic ? "session" : "diagnostic")}
              />
            ) : null}

            {section === "diction" ? (
              <DictionRushGame speechStatus={speechStatus} />
            ) : null}

            {section === "articulation" ? (
              <ArticulationLabGame speechStatus={speechStatus} />
            ) : null}

            {section === "echo" ? (
              <EchoStudioGame onComplete={handleEchoStudioComplete} speechStatus={speechStatus} />
            ) : null}

            {section === "exercises" ? (
              <Exercises
                activeFilter={activeFilter}
                filteredLessons={filteredLessons}
                lessonScores={lessonScores}
                lessonIndex={lessonIndex}
                diagnosticCompleted={hasValidatedDiagnostic}
                recommendedLessonId={recommendedLessonId}
                goal={profile?.goal}
                specialty={profile?.specialty}
                onFilter={setActiveFilter}
                onArticulationLab={() => setSection("articulation")}
                onEchoStudio={() => setSection("echo")}
                onSelectLesson={selectLesson}
              />
            ) : null}

            {section === "session" ? (
              <Session
                activeTake={activeTake}
                error={error}
                isAnalyzing={isAnalyzing}
                isRecording={isRecording}
                lesson={lesson}
                liveLevel={liveLevel}
                onAnalyze={analyzeTake}
                onStart={startRecording}
                onStop={stopRecording}
                recordingTime={recordingTime}
                showAppNav={hasValidatedDiagnostic}
                speechStatus={speechStatus}
                takes={takes}
                setActiveTakeId={setActiveTakeId}
              />
            ) : null}

            {section === "results" ? (
              <Results
                activeTake={activeTake}
                analysis={analysis}
                dimensions={dimensions}
                isAnalyzing={isAnalyzing}
                lesson={lesson}
                recommendation={analysis?.canValidate ? getAdaptiveLessonRecommendation(analysis, profile, lessonScores, lesson.id) : null}
                comparison={comparison}
                onAnalyze={analyzeTake}
                onRetry={() => setSection("session")}
                onStartRecommended={(lessonId) => {
                  const index = lessons.findIndex((item) => item.id === lessonId);
                  if (index >= 0) selectLesson(index, "session");
                }}
              />
            ) : null}

            {section === "progress" ? (
              <Progress
                baseline={baseline}
                baselineAudioUrl={baselineAudioUrl}
                dimensions={dimensions}
                history={practiceHistory}
                totalXp={totalXp}
              />
            ) : null}

            {section === "badges" ? <Badges analysis={analysis} streak={streak} /> : null}
          </div>
        </section>
      </div>

    </main>
  );
}

function Dashboard({
  analysis,
  dimensions,
  lesson,
  levelProgress,
  onPractice,
  onWarmup,
  onDictionRush,
  onArticulationLab,
  onEchoStudio,
  onSelectLesson,
  streak,
  totalXp,
  warmupResult,
}: {
  analysis: AnalysisResult | null;
  dimensions: VoiceDimension[];
  lesson: Lesson;
  levelProgress: number;
  onPractice: () => void;
  onWarmup: () => void;
  onDictionRush: () => void;
  onArticulationLab: () => void;
  onEchoStudio: () => void;
  onSelectLesson: (index: number, nextSection?: AppSection) => void;
  streak: number;
  totalXp: number;
  warmupResult: WarmupDailyResult | null;
}) {
  return (
    <div>
      <section className="mb-5 overflow-hidden rounded-[30px] border border-[#A3E635]/25 bg-[linear-gradient(110deg,rgba(139,92,246,0.18),rgba(163,230,53,0.08))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#A3E635] text-xl font-black text-[#0D0A1A] shadow-[0_0_25px_rgba(163,230,53,0.22)]">
              {warmupResult?.reliable ? warmupResult.score : "♪"}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A3E635]">Échauffement du jour</p>
              <h2 className="mt-1 text-xl font-black">
                {warmupResult?.reliable ? "Ta voix est réveillée." : "Fais décoller Voxi avec ta voix."}
              </h2>
              <p className="mt-1 text-sm text-[#B9ACD7]">
                48 secondes · hauteur relative · aucun score inventé
              </p>
            </div>
          </div>
          <button className="warmup-primary-button shrink-0" onClick={onWarmup}>
            {warmupResult ? "Refaire le vol" : "Échauffer ma voix"}
          </button>
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_420px]">
      <section className="min-w-0 rounded-[32px] border border-white/10 bg-[#161228] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-center">
          <div>
            <span className="rounded-full bg-[#8B5CF6]/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#A78BFA]">
              Exercice du jour
            </span>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Travaille ta voix comme un acteur.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#9D8EC4]">
              Lis le texte, suis les silences, respecte l&apos;intonation cible, puis laisse VoiceAct noter ta prise.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {lesson.focusPoints.map((point) => (
                <span key={point} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-[#FDE68A]">
                  {point}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                className="min-h-14 rounded-2xl bg-[#A3E635] px-6 text-sm font-black text-[#0D0A1A] shadow-[0_0_28px_rgba(163,230,53,0.28)] sm:min-w-52"
                onClick={onPractice}
              >
                Commencer la session
              </button>
              <button
                className="min-h-14 rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-black text-white sm:min-w-52"
                onClick={() => onSelectLesson(1, "session")}
              >
                Essayer documentaire
              </button>
              <button
                className="min-h-14 rounded-2xl border border-[#22D3EE]/35 bg-[#22D3EE]/10 px-6 text-sm font-black text-[#A5F3FC] sm:min-w-52"
                onClick={onDictionRush}
              >
                Jouer Diction Rush
              </button>
              <button
                className="min-h-14 rounded-2xl border border-[#FBBF24]/35 bg-[#FBBF24]/10 px-6 text-sm font-black text-[#FDE68A] sm:min-w-52"
                onClick={onArticulationLab}
              >
                Jouer Articulation Lab
              </button>
              <button
                className="min-h-14 rounded-2xl border border-[#A3E635]/35 bg-[#A3E635]/10 px-6 text-sm font-black text-[#D9F99D] sm:min-w-52"
                onClick={onEchoStudio}
              >
                Jouer Echo Studio
              </button>
            </div>
          </div>
          <div className="rounded-[28px] border border-[#8B5CF6]/25 bg-[#0D0A1A] p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">{lesson.domain}</p>
            <h3 className="mt-3 text-2xl font-black leading-tight">{lesson.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#9D8EC4]">{lesson.objective}</p>
            <div className="mt-4 grid gap-2">
              <div className="rounded-2xl bg-[#8B5CF6]/15 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A78BFA]">Emotion</p>
                <p className="mt-1 text-sm font-black text-white">{lesson.emotion}</p>
              </div>
              <div className="rounded-2xl bg-[#A3E635]/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#BEF264]">Objectif</p>
                <p className="mt-1 text-sm font-bold leading-5 text-[#D9F99D]">{lesson.successCriteria[0]}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="grid gap-4 sm:grid-cols-3 2xl:grid-cols-1">
        {[
          ["XP", `${totalXp}`, "Objectif 200"],
          ["Streak", `${streak} jours`, "Garde le rythme"],
          ["Dernier score", analysis?.analysisStatus === "scored" ? `${analysis.globalScore}/100` : "--", "Après analyse"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-[28px] border border-white/10 bg-[#161228] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9D8EC4]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
            <p className="mt-1 text-sm text-[#9D8EC4]">{hint}</p>
          </div>
        ))}
      </aside>

      <section className="rounded-[32px] border border-white/10 bg-[#161228] p-5 2xl:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A3E635]">Progression rapide</p>
            <h3 className="mt-1 text-2xl font-black">Niveau 1</h3>
          </div>
          <p className="text-sm font-bold text-[#9D8EC4]">{levelProgress}% vers niveau 2</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#A3E635]" style={{ width: `${levelProgress}%` }} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dimensions.map((dimension) => (
            <div key={dimension.label} className="rounded-3xl border border-white/10 bg-[#0D0A1A] p-4">
              <div className="flex items-center justify-between">
                <p className="font-black">{dimension.label}</p>
                <p className="text-sm font-black text-[#A3E635]">{dimension.measured === false ? "--" : dimension.value}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${dimension.measured === false ? 0 : dimension.value}%` }} />
              </div>
              <p className="mt-2 text-xs text-[#9D8EC4]">{dimension.hint}</p>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

function Diagnostic({
  baseline,
  baselineAudioUrl,
  profile,
  onOpenCursus,
  onStartCourse,
  onStartDiagnostic,
}: {
  baseline: BaselineRecord | null;
  baselineAudioUrl: string | null;
  profile: OnboardingProfile | null;
  onOpenCursus: () => void;
  onStartCourse: () => void;
  onStartDiagnostic: (profile?: OnboardingProfile) => void;
}) {
  const [goal, setGoal] = useState<OnboardingProfile["goal"] | "">(profile?.goal ?? "");
  const [specialty, setSpecialty] = useState<VoiceSpecialty | "">(profile?.specialty ?? "");
  const [level, setLevel] = useState<OnboardingProfile["level"] | "">(profile?.level ?? "");
  const sex = profile?.sex ?? "Prefere ne pas dire";
  const referenceVoicePreference = profile?.referenceVoicePreference ?? "Alternee";
  const [frequency, setFrequency] = useState<OnboardingProfile["frequency"] | "">(profile?.frequency ?? "");
  const [onboardingStep, setOnboardingStep] = useState(profile?.specialty ? 4 : 0);
  const [hasStartedWelcome, setHasStartedWelcome] = useState(Boolean(profile?.specialty));
  const [isAdvancing, setIsAdvancing] = useState(false);
  const diagnosticLesson = lessons[0];

  if (baseline) {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-[36px] border border-white/10 bg-[#161228] p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Diagnostic valide</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">Ton cursus est pret.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#9D8EC4]">
            On va avancer etape par etape. VoiceAct adaptera les priorites selon tes scores.
          </p>

          <div className="mt-7 rounded-[30px] border border-[#A3E635]/25 bg-[#A3E635]/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#BEF264]">Score de depart</p>
            <p className="mt-2 text-5xl font-black text-[#A3E635]">{baseline.score}/100</p>
            <p className="mt-2 text-sm leading-6 text-[#D9F99D]">
              Ce score n&apos;est pas une note de passage. Il sert de point de comparaison pour mesurer ton evolution.
            </p>
            {baselineAudioUrl ? <audio className="mt-4 w-full" controls preload="metadata" src={baselineAudioUrl} /> : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="min-h-14 rounded-2xl bg-[#A3E635] px-6 font-black text-[#0D0A1A]" onClick={onStartCourse}>
              Lancer le cursus
            </button>
            <button className="min-h-14 rounded-2xl border border-white/10 bg-white/5 px-6 font-black text-white" onClick={onOpenCursus}>
              Voir le plan
            </button>
          </div>
        </section>

        <aside className="rounded-[36px] border border-white/10 bg-[#161228] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A78BFA]">Plan revele</p>
          <div className="mt-4 space-y-3">
            {getLessonsForGoal(profile?.goal, profile?.specialty).filter((lesson) => lesson.category !== "Diagnostic").map((lesson, index) => (
              <div key={lesson.id} className="rounded-2xl bg-[#0D0A1A] p-4">
                <p className="text-xs font-black text-[#A3E635]">Etape {index + 1}</p>
                <p className="mt-1 font-black">{lesson.title}</p>
                <p className="mt-1 text-sm leading-5 text-[#9D8EC4]">{lesson.objective}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    );
  }

  const specialtyOptions: VoiceSpecialty[] = goal === "Doublage cinema"
    ? ["Film serie", "Animation dessin anime", "Jeu video"]
    : ["Short dynamique", "Video longue storytelling", "Actualite journalisme", "Horreur suspense", "Publicite UGC"];

  const onboardingSteps = [
    {
      eyebrow: "Question 1/4",
      title: "Pourquoi veux-tu améliorer ta voix ?",
      subtitle: "Choisis ton objectif principal. Ton cursus sera construit autour de lui.",
      value: goal,
      options: ["Createur video", "Doublage cinema"],
      onSelect: (value: string) => {
        setGoal(value as OnboardingProfile["goal"]);
        setSpecialty("");
      },
      color: "lime",
    },
    {
      eyebrow: "Question 2/4",
      title: goal === "Doublage cinema" ? "Quel univers veux-tu doubler ?" : "Quel contenu veux-tu principalement créer ?",
      subtitle: "Ce choix change le rythme, le jeu et les exercices de ton cursus.",
      value: specialty,
      options: specialtyOptions,
      onSelect: (value: string) => setSpecialty(value as VoiceSpecialty),
      color: "cyan",
    },
    {
      eyebrow: "Question 3/4",
      title: "Quel est ton niveau aujourd’hui ?",
      subtitle: "Pas de pression. C'est juste pour doser les premiers exercices.",
      value: level,
      options: ["Debutant", "Intermediaire", "Avance"],
      onSelect: (value: string) => setLevel(value as OnboardingProfile["level"]),
      color: "purple",
    },
    {
      eyebrow: "Question 4/6",
      title: "Quel est ton sexe ?",
      subtitle: "Cette information sert seulement à mieux calibrer l’analyse acoustique de ta voix.",
      value: sex,
      options: ["Femme", "Homme", "Prefere ne pas dire"],
      onSelect: () => undefined,
      color: "purple",
    },
    {
      eyebrow: "Question 5/6",
      title: "Quelle voix veux-tu entendre comme exemple ?",
      subtitle: "Ce choix est indépendant de ton sexe. Tu pourras le modifier plus tard.",
      value: referenceVoicePreference,
      options: ["Feminine", "Masculine", "Alternee"],
      onSelect: () => undefined,
      color: "lime",
    },
    {
      eyebrow: "Question 4/4",
      title: "À quel rythme veux-tu t’entraîner ?",
      subtitle: "On va construire un cursus que tu peux vraiment suivre.",
      value: frequency,
      options: ["5 minutes par jour", "10 minutes par jour", "3 fois par semaine"],
      onSelect: (value: string) => setFrequency(value as OnboardingProfile["frequency"]),
      color: "cyan",
    },
  ].filter((_, index) => index !== 3 && index !== 4);
  const isExerciseStep = onboardingStep >= onboardingSteps.length;
  const currentStep = onboardingSteps[Math.min(onboardingStep, onboardingSteps.length - 1)];

  function answerCurrentStep(value: string) {
    if (isAdvancing || isExerciseStep) return;
    currentStep.onSelect(value);
    setIsAdvancing(true);
    window.setTimeout(() => {
      setOnboardingStep((current) => Math.min(current + 1, onboardingSteps.length));
      setIsAdvancing(false);
    }, 360);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!hasStartedWelcome ? (
        <section className="voiceact-onboarding-card relative overflow-hidden rounded-[40px] border border-white/10 bg-[#161228] p-6 shadow-2xl shadow-black/30 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-[#8B5CF6]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-12 size-56 rounded-full bg-[#A3E635]/15 blur-3xl" />
          <div className="relative mx-auto max-w-xl text-center">
            <div className="voiceact-mascot relative mx-auto grid size-28 place-items-center rounded-[34px] bg-[#0D0A1A] shadow-[0_0_34px_rgba(139,92,246,0.35)]">
              <span className="absolute grid size-20 place-items-center rounded-full bg-[#A3E635] text-2xl font-black text-[#0D0A1A]">VA</span>
              <span className="voiceact-mascot-ping" />
            </div>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.24em] text-[#A3E635]">Bienvenue sur VoiceAct</p>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">On va écouter ta voix, puis bâtir ton parcours.</h2>
            <p className="mt-5 text-base leading-7 text-[#CFC3EA]">Réponds à quatre petites questions. Ensuite tu feras une seule prise guidée. VoiceAct s&apos;occupe de comprendre ton point de départ.</p>
            <button className="mt-8 min-h-14 rounded-2xl bg-[#A3E635] px-7 font-black text-[#0D0A1A] shadow-[0_0_24px_rgba(163,230,53,0.2)]" onClick={() => setHasStartedWelcome(true)}>
              Commencer
            </button>
            <p className="mt-4 text-xs font-bold text-[#9D8EC4]">Moins de 2 minutes · aucune note de passage</p>
          </div>
        </section>
      ) : !isExerciseStep ? (
        <section className="voiceact-onboarding-card relative overflow-hidden rounded-[40px] border border-white/10 bg-[#161228] p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#8B5CF6]/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 size-44 rounded-full bg-[#A3E635]/15 blur-2xl" />

          <div className="relative">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {onboardingSteps.map((step, index) => (
                  <span
                    key={step.eyebrow}
                    className={cx("h-2.5 rounded-full transition-all", index <= onboardingStep ? "w-10 bg-[#A3E635]" : "w-2.5 bg-white/15")}
                  />
                ))}
              </div>
              <span className="hidden rounded-full bg-white/5 px-3 py-1 text-xs font-black text-[#9D8EC4] sm:inline-flex">Salut, futur pro vocal</span>
            </div>

            <div className={cx("grid place-items-center text-center transition-all duration-300", isAdvancing && "translate-y-2 opacity-0")}>
              <div className="voiceact-mascot relative mb-5 grid size-24 place-items-center rounded-[32px] bg-[#0D0A1A] text-transparent shadow-[0_0_34px_rgba(139,92,246,0.35)]">
                <span className="absolute grid size-16 place-items-center rounded-full bg-[#A3E635] text-xl font-black text-[#0D0A1A]">VA</span>
                <span className="voiceact-mascot-ping" />
                {["🎯", "🎬", "🎙️", "🧭", "🎧", "⚡"][onboardingStep] ?? "⚡"}
              </div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">{currentStep.eyebrow}</p>
              <h2 className="mt-3 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">{currentStep.title}</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#9D8EC4]">{currentStep.subtitle}</p>
            </div>

            <div className={cx("mt-8 grid gap-3 transition-all duration-300", currentStep.options.length > 3 && "sm:grid-cols-2", isAdvancing && "translate-y-3 opacity-0")}>
              {currentStep.options.map((item) => (
                <button
                  key={item}
                  className={cx(
                    "min-h-16 rounded-[24px] px-5 text-left text-base font-black transition hover:-translate-y-0.5 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-70",
                    currentStep.value === item
                      ? currentStep.color === "purple"
                        ? "bg-[#8B5CF6] text-white shadow-[0_0_24px_rgba(139,92,246,0.25)]"
                        : currentStep.color === "cyan"
                          ? "bg-[#22D3EE] text-[#0D0A1A] shadow-[0_0_24px_rgba(34,211,238,0.22)]"
                          : "bg-[#A3E635] text-[#0D0A1A] shadow-[0_0_24px_rgba(163,230,53,0.22)]"
                      : "bg-[#0D0A1A] text-white ring-1 ring-white/10",
                  )}
                  disabled={isAdvancing}
                  onClick={() => answerCurrentStep(item)}
                >
                  <span className="block">{onboardingOptionLabel(item)}</span>
                  {onboardingOptionHint(item) ? (
                    <span className={cx("mt-1 block text-xs font-bold", currentStep.value === item ? "opacity-75" : "text-[#9D8EC4]")}>
                      {onboardingOptionHint(item)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                className="min-h-12 rounded-2xl border border-white/10 px-5 font-black text-white disabled:opacity-30"
                disabled={onboardingStep === 0 || isAdvancing}
                onClick={() => setOnboardingStep((current) => Math.max(0, current - 1))}
              >
                Retour
              </button>
              <p className="text-right text-xs font-bold leading-5 text-[#9D8EC4]">
                {isAdvancing ? "Je prepare la suite..." : "Choisis une reponse, je t'emmene apres."}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[40px] border border-[#A3E635]/25 bg-[#161228] p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#BEF264]">Exercice de base</p>
          <h2 className="mt-3 text-4xl font-black leading-tight">Maintenant, lis ce texte.</h2>
          <p className="mt-3 text-sm leading-6 text-[#9D8EC4]">
            {onboardingOptionLabel(goal)} · {onboardingOptionLabel(specialty)} · {onboardingOptionLabel(level)}
          </p>

          <div className="mt-6 rounded-[30px] bg-[#0D0A1A] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#BEF264]">Exercice de base</p>
          <h3 className="mt-3 text-2xl font-black">{diagnosticLesson.title}</h3>
          <p className="mt-3 text-sm leading-6 text-[#D9F99D]">Une seule prise guidée. Le prompteur t’indiquera le rythme, les silences et l’intonation.</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F9A8D4]">Intention · {diagnosticLesson.emotion}</p>
            <p className="mt-3 text-base font-bold leading-7">
              {diagnosticLesson.segments.map((segment) => segment.text).join(" ")}
            </p>
          </div>
          <button
            className="mt-5 min-h-14 w-full rounded-2xl bg-[#A3E635] font-black text-[#0D0A1A]"
            onClick={() => onStartDiagnostic({
              goal: goal as OnboardingProfile["goal"],
              specialty: specialty as VoiceSpecialty,
              level: level as OnboardingProfile["level"],
              sex: (sex || "Prefere ne pas dire") as NonNullable<OnboardingProfile["sex"]>,
              referenceVoicePreference: (referenceVoicePreference || "Alternee") as NonNullable<OnboardingProfile["referenceVoicePreference"]>,
              frequency: frequency as OnboardingProfile["frequency"],
              completedAt: new Date().toISOString(),
            })}
          >
            Ouvrir le studio guidé
          </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Exercises({
  activeFilter,
  diagnosticCompleted,
  filteredLessons,
  lessonScores,
  lessonIndex,
  recommendedLessonId,
  goal,
  specialty,
  onFilter,
  onArticulationLab,
  onEchoStudio,
  onSelectLesson,
}: {
  activeFilter: string;
  diagnosticCompleted: boolean;
  filteredLessons: Lesson[];
  lessonScores: Record<string, number>;
  lessonIndex: number;
  recommendedLessonId: string | null;
  goal: OnboardingProfile["goal"] | undefined;
  specialty: VoiceSpecialty | undefined;
  onFilter: (filter: string) => void;
  onArticulationLab: () => void;
  onEchoStudio: () => void;
  onSelectLesson: (index: number, nextSection?: AppSection) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[32px] border border-white/10 bg-[#161228] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A3E635]">Cursus</p>
        <h2 className="mt-2 text-3xl font-black">Valide chaque etape pour debloquer la suite</h2>
        <p className="mt-2 text-sm leading-6 text-[#9D8EC4]">
          Note de passage : {PASS_SCORE}/100. Le logiciel garde ton meilleur score et construit progressivement ton parcours.
        </p>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {lessonFilters.map((filter) => (
            <button
              key={filter}
              className={cx(
                "whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black",
                activeFilter === filter ? "bg-[#A3E635] text-[#0D0A1A]" : "border border-white/10 bg-white/5 text-white",
              )}
              onClick={() => onFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <button
        className="group flex w-full flex-col gap-4 rounded-[30px] border border-[#FBBF24]/25 bg-[#FBBF24]/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#FBBF24]/55 sm:flex-row sm:items-center sm:justify-between"
        onClick={onArticulationLab}
      >
        <span className="min-w-0">
          <span className="block text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">Jeu technique</span>
          <span className="mt-2 block text-2xl font-black text-white">Articulation Lab</span>
          <span className="mt-2 block text-sm leading-6 text-[#FDE68A]">Prépare, lis une phrase courte, puis corrige un son cible sans te perdre.</span>
        </span>
        <span className="warmup-secondary-button inline-flex items-center justify-center">Lancer</span>
      </button>

      <button
        className="group flex w-full flex-col gap-4 rounded-[30px] border border-[#A3E635]/25 bg-[#A3E635]/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#A3E635]/55 sm:flex-row sm:items-center sm:justify-between"
        onClick={onEchoStudio}
      >
        <span className="min-w-0">
          <span className="block text-xs font-black uppercase tracking-[0.2em] text-[#BEF264]">Jeu d&apos;imitation</span>
          <span className="mt-2 block text-2xl font-black text-white">Echo Studio</span>
          <span className="mt-2 block text-sm leading-6 text-[#D9F99D]">Ecoute une voix modele, rejoue une replique, puis corrige une priorite.</span>
        </span>
        <span className="warmup-primary-button inline-flex items-center justify-center">Lancer</span>
      </button>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredLessons.map((item) => {
          const realIndex = lessons.findIndex((lesson) => lesson.id === item.id);
          const active = realIndex === lessonIndex;
          const unlocked = isLessonUnlocked(realIndex, lessonScores, { diagnosticCompleted, recommendedLessonId, goal, specialty });
          const bestScore = lessonScores[item.id];
          const passed = (bestScore ?? 0) >= PASS_SCORE;
          const recommended = item.id === recommendedLessonId;
          return (
            <button
              key={item.id}
              disabled={!unlocked}
              className={cx(
                "group min-w-0 rounded-[30px] border p-5 text-left transition enabled:hover:-translate-y-1 disabled:cursor-not-allowed",
                active
                  ? "border-[#A3E635]/70 bg-[#A3E635] text-[#0D0A1A]"
                  : unlocked
                    ? "border-white/10 bg-[#161228] text-white hover:border-[#8B5CF6]/60"
                    : "border-white/10 bg-[#161228]/55 text-white opacity-55",
              )}
              onClick={() => onSelectLesson(realIndex, "session")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={cx("text-xs font-black uppercase tracking-[0.18em]", active ? "text-[#315000]" : "text-[#A78BFA]")}>
                    {item.world} · {item.category}
                  </p>
                  <h3 className="mt-3 break-words text-2xl font-black leading-tight">{item.title}</h3>
                </div>
                <span className={cx("rounded-full px-3 py-1 text-xs font-black", active ? "bg-[#0D0A1A] text-white" : "bg-white/10 text-[#A3E635]")}>
                  {passed ? "Valide" : recommended ? "Recommande" : unlocked ? `+${item.xp} XP` : "Verrouille"}
                </span>
              </div>
              <p className={cx("mt-4 text-sm leading-6", active ? "text-[#1f2e05]" : "text-[#9D8EC4]")}>{item.objective}</p>
              <p className={cx("mt-3 text-sm font-bold", active ? "text-[#315000]" : "text-[#FBBF24]")}>
                Emotion : {item.emotion}
              </p>
              {recommended ? (
                <p className={cx("mt-3 rounded-2xl p-3 text-sm font-black", active ? "bg-[#0D0A1A]/10" : "bg-[#A3E635]/10 text-[#BEF264]")}>
                  VoiceAct a choisi cet exercice d&apos;apres ton diagnostic.
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={cx("rounded-full px-3 py-1 text-xs font-bold", active ? "bg-[#0D0A1A]/10" : "bg-white/5 text-[#9D8EC4]")}>
                  {item.domain}
                </span>
                <span className={cx("rounded-full px-3 py-1 text-xs font-bold", active ? "bg-[#0D0A1A]/10" : "bg-white/5 text-[#9D8EC4]")}>
                  {getLessonTone(item)}
                </span>
                <span className={cx("rounded-full px-3 py-1 text-xs font-bold", active ? "bg-[#0D0A1A]/10" : "bg-white/5 text-[#9D8EC4]")}>
                  Niv. {item.level}
                </span>
                <span className={cx("rounded-full px-3 py-1 text-xs font-bold", active ? "bg-[#0D0A1A]/10" : "bg-white/5 text-[#9D8EC4]")}>
                  {bestScore ? `Meilleur : ${bestScore}/100` : `Passage : ${PASS_SCORE}/100`}
                </span>
              </div>
              {!unlocked ? (
                <p className="mt-4 rounded-2xl bg-[#0D0A1A]/70 p-3 text-sm font-bold text-[#FDE68A]">
                  Valide l&apos;exercice precedent pour debloquer cette etape.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Session({
  activeTake,
  error,
  isAnalyzing,
  isRecording,
  lesson,
  liveLevel,
  onAnalyze,
  onStart,
  onStop,
  recordingTime,
  showAppNav,
  speechStatus,
  takes,
  setActiveTakeId,
}: {
  activeTake: VoiceTake | null;
  error: string | null;
  isAnalyzing: boolean;
  isRecording: boolean;
  lesson: Lesson;
  liveLevel: number;
  onAnalyze: () => void;
  onStart: () => void;
  onStop: () => void;
  recordingTime: number;
  showAppNav: boolean;
  speechStatus: TranscriptionServiceStatus;
  takes: VoiceTake[];
  setActiveTakeId: (id: string) => void;
}) {
  const guideTimings = useMemo(
    () =>
      lesson.segments.reduce<Array<{ start: number; end: number }>>((timings, segment) => {
        const start = timings.at(-1)?.end ?? 0;
        const end = start + segmentGuideDurationMs(segment, lesson.targetWpm);
        return [...timings, { start, end }];
      }, []),
    [lesson],
  );
  const totalGuideDurationMs = guideTimings.at(-1)?.end ?? 1;
  const prompterPreRollMs = 3000;
  const elapsedGuideMs = Math.max(0, Math.min(recordingTime * 1000 - prompterPreRollMs, totalGuideDurationMs));
  const matchedGuideIndex = guideTimings.findIndex((timing) => elapsedGuideMs >= timing.start && elapsedGuideMs <= timing.end);
  const activeGuideIndex = isRecording ? (matchedGuideIndex >= 0 ? matchedGuideIndex : Math.max(0, lesson.segments.length - 1)) : 0;
  const activeSegment = lesson.segments[activeGuideIndex] ?? lesson.segments[0];
  const guideProgress = isRecording ? Math.min(100, Math.round((elapsedGuideMs / totalGuideDurationMs) * 100)) : 0;
  const prompterPxPerMs = prompterMotionPixelsPerMs(lesson.targetWpm, lesson.segments);
  const prompterRhythmLabel = prompterRateLabel(lesson.targetWpm, lesson.segments);
  const prompterElapsedMs = isRecording ? Math.min(recordingTime * 1000, totalGuideDurationMs + prompterPreRollMs) : 0;
  const guideSegments = guideTimings.map((timing, index) => ({
    ...timing,
    segment: lesson.segments[index],
    width: ((timing.end - timing.start) / totalGuideDurationMs) * 100,
  }));
  const promptPhrases = lesson.segments.reduce<
    Array<{
      key: string;
      label: string;
      segment: Lesson["segments"][number];
      startMs: number;
      readEndMs: number;
      endMs: number;
      speechWidthPx: number;
      pauseWidthPx: number;
      wordTimings: ReturnType<typeof buildPromptWordTimings>;
    }>
  >((tokens, segment, segmentIndex) => {
    const cursor = tokens.at(-1)?.endMs ?? prompterPreRollMs;
    const readDuration = segmentReadDurationMs(segment, lesson.targetWpm);
    const startMs = cursor;
    const readEndMs = startMs + readDuration;
    const endMs = readEndMs + segment.pauseAfterMs;

    return [
      ...tokens,
      {
        key: `${segmentIndex}-${segment.text}`,
        label: segment.text,
        segment,
        startMs,
        readEndMs,
        endMs,
        speechWidthPx: readDuration * prompterPxPerMs,
        pauseWidthPx: segment.pauseAfterMs * prompterPxPerMs,
        wordTimings: buildPromptWordTimings(segment, lesson.targetWpm, readDuration),
      },
    ];
  }, []);
  const activePromptPhrase =
    promptPhrases.find((phrase) => prompterElapsedMs >= phrase.startMs && prompterElapsedMs <= phrase.endMs) ?? promptPhrases[0] ?? null;
  const activePromptIsPause = Boolean(activePromptPhrase && prompterElapsedMs > activePromptPhrase.readEndMs);
  const prompterTotalDurationMs = promptPhrases.at(-1)?.endMs ?? prompterPreRollMs;

  return (
    <div className={cx("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_380px]", showAppNav ? "pb-36" : "pb-24")}>
      <section className="min-w-0 rounded-[36px] border border-white/10 bg-[#161228] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">{lesson.domain}</p>
            <h2 className="mt-2 break-words text-2xl font-black leading-tight sm:text-4xl">{lesson.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9D8EC4]">{lesson.coachTip}</p>
          </div>
          <div className="hidden rounded-3xl bg-[#0D0A1A] px-5 py-3 text-left sm:block sm:text-right">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FBBF24]">Timer</p>
            <p className="text-2xl font-black">{isRecording ? formatDuration(recordingTime) : "00:00"}</p>
            <p className={cx("mt-1 text-[10px] font-black uppercase tracking-[0.12em]", isTranscriptionUsable(speechStatus) ? "text-[#A3E635]" : speechStatus === "offline" ? "text-[#FBBF24]" : "text-[#9D8EC4]")}>
              {speechStatus === "advanced" ? "Analyse avancee active" : speechStatus === "standard" ? "Analyse standard active" : speechStatus === "offline" ? "Moteur vocal hors ligne" : "Verification moteur"}
            </p>
          </div>
        </div>

        <div className="hidden">
          <div className="min-w-0 rounded-[28px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A78BFA]">Situation</p>
            <p className="mt-2 text-sm leading-6 text-[#D8CCFF]">{lesson.scenario}</p>
          </div>
          <div className="min-w-0 rounded-[28px] border border-[#F472B6]/30 bg-[#F472B6]/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F9A8D4]">Emotion</p>
            <p className="mt-2 break-words text-2xl font-black">{lesson.emotion}</p>
            <p className="mt-1 text-sm text-[#9D8EC4]">Ne joue pas le texte, joue l&apos;intention.</p>
          </div>
          <div className="min-w-0 rounded-[28px] border border-[#A3E635]/30 bg-[#A3E635]/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#BEF264]">Objectif de reussite</p>
            <p className="mt-2 text-sm leading-6 text-[#D9F99D]">{lesson.successCriteria[0]}</p>
          </div>
        </div>

        <div className="hidden">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#67E8F9]">Avant REC</p>
          <div className="mt-3 grid gap-2">
            <p className="text-sm leading-6 text-[#BAE6FD]">1. Inspire doucement avant la premiere phrase.</p>
            <p className="text-sm leading-6 text-[#BAE6FD]">2. Joue : {lesson.emotion.toLowerCase()}.</p>
            <p className="text-sm leading-6 text-[#BAE6FD]">3. Ne remplis pas les pauses. Laisse-les vivre.</p>
          </div>
        </div>

        <div className="mt-5 min-w-0 overflow-hidden rounded-[34px] border border-white/10 bg-[#090713] shadow-2xl shadow-black/30">
          <div className="relative min-h-[150px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.35),transparent_32%),linear-gradient(135deg,#122135,#090713_62%)] p-5 sm:min-h-[190px] sm:p-7">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090713] to-transparent" />
            <div className="relative flex min-h-[105px] flex-col justify-between sm:min-h-[140px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">Studio guide</p>
                  <h3 className="mt-2 max-w-xl text-2xl font-black leading-tight sm:text-4xl">
                    {lesson.category === "Doublage" ? "Joue la scene au bon timing." : "Lis avec le rythme du prompteur."}
                  </h3>
                </div>
                <div className="hidden rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur sm:block">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FBBF24]">REC</p>
                  <p className="text-xl font-black">{isRecording ? formatDuration(recordingTime) : "00:00"}</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4">
                <p className="hidden w-full max-w-3xl text-sm leading-6 text-[#D8CCFF] sm:block">{lesson.scenario}</p>
                <div className="flex flex-wrap gap-2">
                  <div className="voiceact-intention-chip rounded-2xl bg-[#A3E635] px-4 py-3 text-[#0D0A1A]">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">Intention</p>
                    <p className="text-sm font-black">{lesson.emotion}</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4B5FD]">Cadence</p>
                    <p className="text-sm font-black">{prompterRhythmLabel} · {lesson.targetWpm} MPM moyen</p>
                  </div>
                </div>
                {lesson.referenceAudio?.status === "licensed" && lesson.referenceAudio.localPath ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-[#67E8F9]/25 bg-[#67E8F9]/10 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 sm:w-52">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#67E8F9]">Exemple professionnel</p>
                      <p className="truncate text-xs font-bold text-[#CFFAFE]">{lesson.referenceAudio.title}</p>
                      <p className="mt-0.5 truncate text-[9px] text-[#A5F3FC]/75">
                        {lesson.referenceAudio.license}
                        {lesson.referenceAudio.sourceUrl ? (
                          <>
                            {" · "}
                            <a
                              className="underline decoration-[#67E8F9]/50 underline-offset-2 hover:text-white"
                              href={lesson.referenceAudio.sourceUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              source
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <audio className="h-9 min-w-0 flex-1" controls preload="metadata" src={lesson.referenceAudio.localPath} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cx("voiceact-prompter-stage relative border-y border-white/10 text-[#12101A]", isRecording && "is-running")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-7 items-center justify-between px-[4%] text-[9px] font-black uppercase tracking-[0.2em] text-[#776B87]">
              <span className="ml-[7%] text-[#EF4444]">À jouer</span>
              <span className="flex items-center gap-3">
                <span><b className="text-[#7C3AED]">Violet</b> = accélère</span>
                <span><b className="text-base leading-none text-[#12101A]">A</b><b className="text-[8px] text-[#12101A]">a</b> = intensité</span>
                <span className="hidden sm:inline">Lis en avance →</span>
              </span>
            </div>
            <div
              className={cx(
                "voiceact-playhead pointer-events-none absolute bottom-0 left-[9%] top-0 z-30 w-[3px] -translate-x-1/2 bg-[#EF4444] shadow-[0_0_18px_rgba(239,68,68,0.82)]",
                isRecording ? "opacity-100" : "opacity-60",
              )}
            >
              <span className="voiceact-playhead-pulse absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#EF4444]/50" />
              <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-[#EF4444]" />
              <span className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-[#EF4444]" />
            </div>

            <div className="relative h-36 overflow-hidden pt-5 sm:h-40">
              <div className="voiceact-prompter-flow pointer-events-none absolute inset-x-0 bottom-2 h-px opacity-35" />
              <SmoothPrompterStrip
                isRecording={isRecording}
                pixelsPerMs={prompterPxPerMs}
                timelineKey={lesson.id}
                totalDurationMs={prompterTotalDurationMs}
              >
                <span
                  className="inline-flex h-28 items-center justify-center border-r border-[#12101A]/10 bg-[#12101A]/5 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#5F556B] sm:h-32"
                  data-prompt-time-ms={0}
                  style={{ width: `${prompterPreRollMs * prompterPxPerMs}px` }}
                >
                  <span className="voiceact-ready-pill rounded-full border border-[#8B5CF6]/25 bg-white/70 px-4 py-2">3 · 2 · 1</span>
                </span>
                {promptPhrases.map(({ key, segment, startMs, readEndMs, speechWidthPx, pauseWidthPx, wordTimings }) => (
                  <div
                    key={key}
                    className={cx(
                      "relative flex h-28 w-max border-r border-[#12101A]/10 transition-colors duration-200 sm:h-32",
                      activePromptPhrase?.key === key ? "bg-white" : "bg-[#F4F1EA]/80",
                    )}
                  >
                    <div className="relative flex h-full w-max shrink-0 flex-col justify-center px-3 sm:px-4" style={{ minWidth: `${speechWidthPx}px` }}>
                      <p
                        className={cx("w-max whitespace-nowrap font-black leading-none tracking-[-0.025em] text-[#12101A]", promptPhraseSizeClass(segment.energy))}
                        style={{ transform: `translateY(${promptPitchOffset(segment.intonation)}px)` }}
                      >
                        {wordTimings.map((word, wordIndex) => (
                          <span key={`${key}-${wordIndex}`}>
                            <span
                              className={cx(
                                promptWordSizeClass(word.sizeCue),
                                word.accelerated && "text-[#6D28D9] [text-shadow:0_0_18px_rgba(139,92,246,0.22)]",
                              )}
                              data-prompt-time-ms={startMs + word.startMs}
                              title={word.accelerated ? "Accélère ce mot" : word.sizeCue === "strong" ? "Hausse l'intensité" : word.sizeCue === "soft" ? "Parle plus calmement" : undefined}
                            >
                              {word.word}
                            </span>
                            {wordIndex < wordTimings.length - 1 ? " " : null}
                          </span>
                        ))}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#665B72] sm:text-[10px]">
                        <span className="rounded-full bg-[#F472B6]/15 px-2 py-1">{voiceVolumeLabel(segment.energy)}</span>
                        <span>{intonationLabel(segment.intonation)}</span>
                      </div>
                      <svg className="absolute bottom-1 left-4 h-4 w-28 opacity-80" viewBox="0 0 128 70" aria-hidden="true">
                        <path d={curvePath(segment.intonation)} fill="none" stroke="#8B5CF6" strokeLinecap="round" strokeWidth="7" />
                      </svg>
                      <span className="absolute bottom-0 left-0 h-1 w-full bg-[#8B5CF6]" />
                    </div>
                    <div
                      className={cx(
                        "voiceact-pause-lane relative flex h-full shrink-0 items-center justify-center overflow-hidden border-l border-[#8B5CF6]/20",
                        activePromptPhrase?.key === key && activePromptIsPause && "is-active",
                      )}
                      data-prompt-time-ms={readEndMs}
                      style={{ width: `${pauseWidthPx}px` }}
                    >
                      <span className="rotate-[-90deg] whitespace-nowrap text-[9px] font-black uppercase tracking-[0.14em] text-[#6D5F7B]">
                        {segment.pauseAfterMs >= 750 ? "laisse vivre" : "respire"}
                      </span>
                    </div>
                  </div>
                ))}
                <span className="block h-px w-px" data-prompt-time-ms={prompterTotalDurationMs} />
              </SmoothPrompterStrip>
            </div>

            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-[#12101A]/10 bg-white/65 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#5F556B]">
              <span className={cx("truncate", activePromptIsPause && isRecording ? "text-[#8B5CF6]" : "text-[#5F556B]")}>
                {activePromptIsPause && isRecording ? `Silence · ${activeSegment.pauseAfterMs} ms` : activeSegment.deliveryCue}
              </span>
              <span className="shrink-0 rounded-full bg-[#12101A] px-3 py-1 text-white">{guideProgress}%</span>
            </div>

            <div className="hidden min-h-24 w-full overflow-hidden">
              {guideSegments.map(({ segment, width }, index) =>
                segment ? (
                  <div
                    key={`${lesson.id}-ribbon-${index}`}
                    className={cx(
                      "relative flex min-w-0 flex-col justify-center border-r border-[#12101A]/10 px-3 py-4 transition-all duration-300",
                      index === activeGuideIndex && isRecording ? "bg-white" : "bg-[#F4F1EA]",
                    )}
                    style={{ flexBasis: `${width}%`, flexGrow: width, flexShrink: 1 }}
                  >
                    <p
                      className={cx(
                        "line-clamp-2 font-black leading-tight",
                        segment.energy === "high" ? "text-xl sm:text-2xl" : segment.energy === "low" ? "text-sm sm:text-base" : "text-base sm:text-xl",
                      )}
                    >
                      {segment.text}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#5F556B]">
                      <span>{voiceVolumeLabel(segment.energy)}</span>
                      <span>·</span>
                      <span>{segment.pauseAfterMs} ms</span>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          <div className="hidden gap-4 border-b border-white/10 bg-[#0D0A1A] p-5 sm:grid sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">
                {isRecording ? "Enregistrement en cours" : "Pret pour la prise"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#9D8EC4]">
                Appuie sur REC, lis ce qui arrive depuis la droite, puis joue la phrase quand elle touche la ligne rouge.
              </p>
            </div>
            <button
              className={cx(
                "grid size-24 place-items-center rounded-full text-sm font-black uppercase tracking-[0.18em] text-white transition active:scale-95 sm:size-28",
                isRecording
                  ? "bg-[#F472B6] shadow-[0_0_46px_rgba(244,114,182,0.45)]"
                  : "bg-[#8B5CF6] shadow-[0_0_46px_rgba(139,92,246,0.45)]",
              )}
              onClick={isRecording ? onStop : onStart}
            >
              {isRecording ? "Stop" : "Rec"}
            </button>
          </div>

          <div className="hidden gap-5 p-5 sm:grid sm:p-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">
                  {activePromptIsPause && isRecording
                    ? "Silence maintenant"
                    : isRecording
                      ? "A lire maintenant"
                      : "Prepare ta premiere phrase"}
                </p>
                <p className="text-xs font-black text-[#9D8EC4]">{guideProgress}%</p>
              </div>
              <p className={cx("mt-4 break-words font-black leading-[1.03] tracking-tight text-white", voiceSizeClass(activeSegment.energy))}>
                {activeSegment.text}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#F472B6]/15 px-3 py-1 text-xs font-black text-[#F9A8D4]">{voiceVolumeLabel(activeSegment.energy)}</span>
                <span className="rounded-full bg-[#22D3EE]/15 px-3 py-1 text-xs font-black text-[#67E8F9]">{intonationLabel(activeSegment.intonation)}</span>
                <span className="rounded-full bg-[#A3E635]/15 px-3 py-1 text-xs font-black text-[#BEF264]">Silence {activeSegment.pauseAfterMs} ms</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#D8CCFF]">{activeSegment.deliveryCue}</p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0D0A1A] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A78BFA]">Courbe</p>
              <svg className="mt-3 h-24 w-full" viewBox="0 0 128 70" role="img" aria-label="Courbe d'intonation">
                <path d="M8 58 H120" stroke="rgba(240,235,255,0.1)" strokeWidth="2" />
                <path d={curvePath(activeSegment.intonation)} fill="none" stroke="#A3E635" strokeLinecap="round" strokeWidth="6" />
              </svg>
              <p className="mt-3 text-xs leading-5 text-[#9D8EC4]">Accentue : {activeSegment.emphasis.join(", ")}.</p>
            </div>
          </div>
        </div>

        <div className="hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A78BFA]">Timeline de lecture</p>
              <h3 className="mt-2 text-2xl font-black">Lis comme la ligne te guide.</h3>
            </div>
            <div className="rounded-2xl bg-[#A3E635] px-4 py-3 text-[#0D0A1A]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">Ton / emotion</p>
              <p className="text-sm font-black">{lesson.emotion}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-[#A3E635]/25 bg-[#A3E635]/10 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#BEF264]">
                {isRecording ? "Phrase active" : "Prompteur pret"}
              </p>
              <p className="text-xs font-black text-[#D9F99D]">{guideProgress}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#A3E635] transition-all duration-300" style={{ width: `${Math.max(isRecording ? 8 : 0, guideProgress)}%` }} />
            </div>
            {activeSegment ? (
              <div className="mt-5">
                <p className={cx("break-words font-black leading-[1.05] tracking-tight text-white", voiceSizeClass(activeSegment.energy))}>
                  {activeSegment.text}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#D9F99D]">
                  {voiceVolumeLabel(activeSegment.energy)} · {intonationLabel(activeSegment.intonation)} · silence {activeSegment.pauseAfterMs} ms
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-5">
            {lesson.segments.map((segment, index) => (
              <article
                key={`${lesson.id}-${index}`}
                className={cx(
                  "relative min-w-0 rounded-[28px] border p-4 transition-all duration-300 sm:p-5",
                  isRecording && index === activeGuideIndex
                    ? "border-[#A3E635]/55 bg-[#A3E635]/10 shadow-[0_0_28px_rgba(163,230,53,0.12)]"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <div className="absolute bottom-0 left-7 top-14 hidden w-px bg-white/10 sm:block" />
                <div className="flex gap-4">
                  <div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-[#8B5CF6] text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#F472B6]/15 px-3 py-1 text-xs font-black text-[#F9A8D4]">
                        {voiceVolumeLabel(segment.energy)}
                      </span>
                      <span className="rounded-full bg-[#22D3EE]/15 px-3 py-1 text-xs font-black text-[#67E8F9]">
                        {intonationLabel(segment.intonation)}
                      </span>
                      <span className="rounded-full bg-[#A3E635]/15 px-3 py-1 text-xs font-black text-[#BEF264]">
                        Silence {segment.pauseAfterMs} ms
                      </span>
                    </div>

                    <p className={cx("mt-4 break-words font-black leading-[1.08] tracking-tight", voiceSizeClass(segment.energy))}>
                      {segment.text}
                    </p>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-center">
                      <div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full bg-[#8B5CF6]" style={{ width: "62%" }} />
                          <span
                            className="block h-full bg-[#A3E635]"
                            style={{ width: `${Math.min(38, Math.max(12, segment.pauseAfterMs / 32))}%` }}
                          />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#D8CCFF]">{segment.deliveryCue}</p>
                        <p className="mt-2 text-xs leading-5 text-[#9D8EC4]">
                          Pause : {pauseLabel(segment.pauseAfterMs)}. Accentue : {segment.emphasis.join(", ")}.
                        </p>
                      </div>
                      <svg className="h-20 w-full" viewBox="0 0 128 70" role="img" aria-label="Courbe d'intonation">
                        <path d="M8 58 H120" stroke="rgba(240,235,255,0.1)" strokeWidth="2" />
                        <path d={curvePath(segment.intonation)} fill="none" stroke="#A3E635" strokeLinecap="round" strokeWidth="6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="hidden">
          <Waveform active={isRecording} level={liveLevel} />
          <div className="mt-6 flex flex-col items-center gap-4">
            <button
              className={cx(
                "grid size-28 place-items-center rounded-full text-sm font-black uppercase tracking-[0.18em] text-white transition active:scale-95",
                isRecording
                  ? "bg-[#F472B6] shadow-[0_0_46px_rgba(244,114,182,0.45)]"
                  : "bg-[#8B5CF6] shadow-[0_0_46px_rgba(139,92,246,0.45)]",
              )}
              onClick={isRecording ? onStop : onStart}
            >
              {isRecording ? "Stop" : "Rec"}
            </button>
            <p className="text-center text-sm text-[#9D8EC4]">
              {isRecording ? "Parle maintenant. Marque les silences indiques." : "Appuie, lis le texte, puis analyse ta prise."}
            </p>
          </div>
        </div>
      </section>

      <aside className="hidden space-y-5 xl:block">
        <div className="hidden">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#67E8F9]">Avant REC</p>
          <h3 className="mt-2 break-words text-xl font-black">Mini routine de jeu</h3>
          <div className="mt-4 space-y-3">
            {[
              ["Respiration", "Inspire doucement avant la premiere phrase."],
              ["Intention", `Joue : ${lesson.emotion.toLowerCase()}.`],
              ["Silence", "Ne remplis pas les pauses. Laisse-les vivre."],
            ].map(([title, hint], index) => (
              <div key={title} className="flex gap-3 rounded-2xl bg-[#0D0A1A]/70 p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#22D3EE] text-xs font-black text-[#0D0A1A]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-black">{title}</p>
                  <p className="mt-1 text-sm leading-5 text-[#BAE6FD]">{hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[32px] border border-white/10 bg-[#161228] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Prise active</p>
          <p className="mt-2 break-words text-xl font-black">
            {isRecording
              ? `REC - ${formatDuration(recordingTime)}`
              : activeTake
                ? `${activeTake.label} - ${formatDuration(activeTake.duration)}`
                : "Aucune prise"}
          </p>
          {activeTake ? (
            <audio className="mt-4 w-full accent-[#8B5CF6]" controls src={activeTake.url}>
              <track kind="captions" />
            </audio>
          ) : null}
          <button
            className="mt-4 min-h-14 w-full rounded-2xl bg-[#A3E635] text-sm font-black text-[#0D0A1A] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!activeTake || isRecording || isAnalyzing}
            onClick={onAnalyze}
          >
            {isAnalyzing ? "Analyse en cours..." : "Analyser ma voix"}
          </button>
          {error ? <p className="mt-4 rounded-2xl border border-[#F472B6]/40 bg-[#F472B6]/10 p-3 text-sm text-[#FBCFE8]">{error}</p> : null}
        </div>

        <div className="min-w-0 rounded-[32px] border border-white/10 bg-[#161228] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A78BFA]">Historique rapide</p>
          <div className="mt-4 space-y-2">
            {takes.length === 0 ? <p className="text-sm text-[#9D8EC4]">Tes prises apparaitront ici.</p> : null}
            {takes.map((take) => (
              <button
                key={take.id}
                className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left"
                onClick={() => setActiveTakeId(take.id)}
              >
                <span className="font-bold">{take.label}</span>
                <span className="text-sm text-[#9D8EC4]">{formatDuration(take.duration)}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="mx-3 mt-3 rounded-[28px] border border-white/10 bg-[#161228]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <button
            className={cx(
              "grid size-16 shrink-0 place-items-center rounded-full text-xs font-black uppercase tracking-[0.14em] text-white transition active:scale-95",
              isRecording
                ? "bg-[#F472B6] shadow-[0_0_30px_rgba(244,114,182,0.45)]"
                : "bg-[#8B5CF6] shadow-[0_0_30px_rgba(139,92,246,0.45)]",
            )}
            onClick={isRecording ? onStop : onStart}
          >
            {isRecording ? "Stop" : "Rec"}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-black">{isRecording ? "Enregistrement" : activeTake ? activeTake.label : "Pret a enregistrer"}</p>
              <p className="shrink-0 text-sm font-black text-[#A3E635]">
                {isRecording ? formatDuration(recordingTime) : activeTake ? formatDuration(activeTake.duration) : "00:00"}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#A3E635]" style={{ width: `${isRecording ? Math.max(8, liveLevel) : activeTake ? 100 : 8}%` }} />
            </div>
          </div>

          <button
            className="min-h-12 shrink-0 rounded-2xl bg-[#A3E635] px-4 text-xs font-black text-[#0D0A1A] disabled:opacity-40"
            disabled={!activeTake || isRecording || isAnalyzing}
            onClick={onAnalyze}
          >
            {isAnalyzing ? "..." : "Score"}
          </button>
        </div>
        {error ? <p className="mt-2 rounded-2xl bg-[#F472B6]/15 p-2 text-xs text-[#FBCFE8]">{error}</p> : null}
      </div>
    </div>
  );
}

function Results({
  activeTake,
  analysis,
  comparison,
  dimensions,
  isAnalyzing,
  lesson,
  onAnalyze,
  onRetry,
  onStartRecommended,
  recommendation,
}: {
  activeTake: VoiceTake | null;
  analysis: AnalysisResult | null;
  comparison: AttemptComparison | null;
  dimensions: VoiceDimension[];
  isAnalyzing: boolean;
  lesson: Lesson;
  onAnalyze: () => void;
  onRetry: () => void;
  onStartRecommended: (lessonId: string) => void;
  recommendation: AdaptiveLessonRecommendation | null;
}) {
  const weakestDimension = getWeakestDimension(dimensions);
  const bestDimension = getBestDimension(dimensions);

  if (!analysis) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-[36px] border border-white/10 bg-[#161228] p-6 text-center">
        <div className="max-w-md">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Resultats IA</p>
          <h2 className="mt-3 text-3xl font-black">Pas encore de score</h2>
          <p className="mt-3 text-[#9D8EC4]">Enregistre une prise dans le studio, puis lance l&apos;analyse.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button className="min-h-14 rounded-2xl bg-[#8B5CF6] px-6 font-black text-white" onClick={onRetry}>
              Aller au studio
            </button>
            <button
              className="min-h-14 rounded-2xl border border-white/10 px-6 font-black text-white disabled:opacity-40"
              disabled={!activeTake || isAnalyzing}
              onClick={onAnalyze}
            >
              Analyser
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (analysis.analysisStatus !== "scored") {
    const noSpeech = analysis.analysisStatus === "no-speech";
    return (
      <div className="voiceact-result-empty relative grid min-h-[66vh] place-items-center overflow-hidden rounded-[40px] border border-white/10 bg-[#161228] px-5 py-12 text-center sm:px-8">
        <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-[#8B5CF6]/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 size-72 rounded-full bg-[#A3E635]/10 blur-3xl" />
        <div className="relative max-w-xl">
          <div className="voiceact-silent-orb relative mx-auto grid size-36 place-items-center rounded-full border border-white/10 bg-[#0D0A1A] shadow-[0_0_60px_rgba(139,92,246,0.24)]">
            <div className="flex h-16 items-center gap-2" aria-hidden="true">
              {[22, 42, 62, 42, 22].map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="voiceact-silent-bar w-2 rounded-full bg-[#A3E635]"
                  style={{ height, animationDelay: `${index * 90}ms` }}
                />
              ))}
            </div>
            <span className="voiceact-silent-ring absolute inset-4 rounded-full border border-[#A3E635]/35" />
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">Prise non notée</p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            {noSpeech ? "Je n’ai pas entendu ta voix." : "L’analyse n’a pas pu démarrer."}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#B7A9DA] sm:text-lg">
            {noSpeech
              ? "Aucun score n’a été créé. Rapproche-toi du micro, puis commence à parler dès que la phrase touche la ligne rouge."
              : analysis.failureReason || "Ta prise reste intacte, mais elle n’a pas été notée. Réessaie dans un instant."}
          </p>
          <button
            className="mt-8 min-h-14 w-full rounded-2xl bg-[#A3E635] px-8 font-black text-[#0D0A1A] shadow-[0_0_32px_rgba(163,230,53,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_0_42px_rgba(163,230,53,0.38)] sm:w-auto"
            onClick={onRetry}
          >
            Refaire la prise
          </button>
        </div>
      </div>
    );
  }

  const isDiagnostic = lesson.category === "Diagnostic";
  const passed = isDiagnostic ? analysis.analysisStatus === "scored" : analysis.canValidate !== false && analysis.globalScore >= PASS_SCORE;
  const isFullAnalysis = analysis.analysisMode !== "local-only";

  return (
    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#161228] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-20 top-10 size-56 rounded-full bg-[#8B5CF6]/15 blur-3xl" />
        <p className="relative text-xs font-black uppercase tracking-[0.22em] text-[#A3E635]">Ta performance</p>
        <div className="relative mt-5 flex justify-center">
          <ScoreCircle score={analysis.globalScore} />
        </div>
        <p className="mt-2 text-center text-xl font-black text-white">{getScoreGrade(analysis.globalScore)}</p>
        <p className="mt-2 text-center text-sm text-[#9D8EC4]">
          {isDiagnostic ? "Diagnostic de départ" : passed ? "Étape validée" : `Objectif : ${PASS_SCORE}/100`}
        </p>
        {analysis.badge && analysis.canValidate ? (
          <div className="mt-5 rounded-[24px] border border-[#A3E635]/20 bg-[#A3E635]/10 p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BEF264]">Nouveau badge</p>
            <p className="mt-1 font-black">{analysis.badge} · +{analysis.xpEarned} XP</p>
          </div>
        ) : null}
        <button className="relative mt-6 min-h-14 w-full rounded-2xl bg-[#8B5CF6] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#9B71F7]" onClick={onRetry}>
          Refaire une prise
        </button>
        {activeTake ? (
          <details className="relative mt-4 text-center">
            <summary className="cursor-pointer text-sm font-bold text-[#9D8EC4]">Réécouter ma prise</summary>
            <audio className="mt-3 w-full" controls preload="metadata" src={activeTake.url} />
          </details>
        ) : null}
      </section>

      <section className="space-y-5">
        <div className="rounded-[36px] border border-white/10 bg-[#161228] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A78BFA]">Ton coach</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Une priorité, pas dix.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[#A3E635]/20 bg-[#A3E635]/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BEF264]">Point fort</p>
              <p className="mt-2 text-xl font-black">{bestDimension.label}</p>
            </div>
            <div className="rounded-[24px] border border-[#FBBF24]/20 bg-[#FBBF24]/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FBBF24]">À travailler</p>
              <p className="mt-2 text-xl font-black">{weakestDimension.label}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[24px] bg-[#0D0A1A] p-5">
            <p className="text-sm leading-7 text-[#D8CCFF]">{analysis.advice}</p>
            <p className="mt-3 font-black text-[#A3E635]">{analysis.nextGoal}</p>
          </div>
        </div>

        {recommendation && analysis.canValidate ? (
          <div className="rounded-[36px] border border-[#A3E635]/30 bg-[#A3E635]/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#BEF264]">Prochain exercice adapte</p>
            <h3 className="mt-2 text-2xl font-black">{recommendation.lessonTitle}</h3>
            <p className="mt-3 text-sm leading-6 text-[#D9F99D]">
              Choisi pour travailler en priorite : {recommendation.dimension}.
            </p>
            <button
              className="mt-5 min-h-14 w-full rounded-2xl bg-[#A3E635] px-5 font-black text-[#0D0A1A]"
              onClick={() => onStartRecommended(recommendation.lessonId)}
            >
              Lancer cet exercice
            </button>
          </div>
        ) : null}

        {comparison ? (
          <div className="rounded-[36px] border border-[#22D3EE]/25 bg-[#22D3EE]/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#67E8F9]">Comparaison des prises</p>
            <h3 className="mt-2 text-2xl font-black">{comparison.lessonTitle}</h3>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-[#0D0A1A]/70 p-3">
                <p className="text-xs text-[#9D8EC4]">Avant</p><p className="text-2xl font-black">{comparison.previousScore}</p>
              </div>
              <div className="rounded-2xl bg-[#0D0A1A]/70 p-3">
                <p className="text-xs text-[#9D8EC4]">Maintenant</p><p className="text-2xl font-black">{comparison.currentScore}</p>
              </div>
              <div className="rounded-2xl bg-[#0D0A1A]/70 p-3">
                <p className="text-xs text-[#9D8EC4]">Evolution</p>
                <p className={cx("text-2xl font-black", comparison.delta >= 0 ? "text-[#A3E635]" : "text-[#FBBF24]")}>
                  {comparison.delta >= 0 ? "+" : ""}{comparison.delta}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <details className="group rounded-[28px] border border-white/10 bg-[#161228] p-5 sm:p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-[#A78BFA]">
            <span>Voir le détail de l’analyse</span>
            <span className="text-xl transition group-open:rotate-45">+</span>
          </summary>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {dimensions.map((dimension) => (
            <div key={dimension.label} className="rounded-[28px] border border-white/10 bg-[#161228] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-black">{dimension.label}</p>
                  <p className="text-sm text-[#9D8EC4]">{dimension.hint}</p>
                </div>
                <p className="text-3xl font-black text-[#A3E635]">{dimension.measured === false ? "--" : dimension.value}</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${dimension.measured === false ? 0 : dimension.value}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Précision phonétique", analysis.pronunciation?.score == null ? "--" : `${analysis.pronunciation.score}%`],
            ["Exactitude", isFullAnalysis ? `${analysis.wordAccuracyPercent ?? 0}%` : "--"],
            ["Debit", `${analysis.wpm}/${analysis.targetWpm}`],
            ["Pauses", `${analysis.pauseCount}/${analysis.expectedPauses}`],
            ["Intonation", `${Math.round(analysis.pitchRangeSemitones ?? 0)} demi-tons`],
            ["Dynamique", analysis.intensityRangeDb === undefined ? "--" : `${analysis.intensityRangeDb.toFixed(1)} dB`],
            ["Harmonicite", analysis.hnrMeanDb == null ? "--" : `${analysis.hnrMeanDb.toFixed(1)} dB HNR`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-[#0D0A1A] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9D8EC4]">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        {analysis.pronunciation?.phones.length ? (
          <details className="rounded-[28px] border border-[#A3E635]/20 bg-[#11101F] p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black text-[#BEF264]">
              <span>
                Précision des sons · {analysis.pronunciation.assessedPhoneCount}/{analysis.pronunciation.phones.length} mesurés
              </span>
              <span className="text-[#9D8EC4]">
                {analysis.pronunciation.canValidate ? "fiable" : "informatif"}
              </span>
            </summary>
            <p className="mt-4 text-sm leading-6 text-[#D8CCFF]">
              {analysis.pronunciation.priority ?? analysis.pronunciation.scoringReason}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.pronunciation.phones
                .filter((phone) => phone.status === "retry" || phone.status === "fragile")
                .slice(0, 8)
                .map((phone, index) => (
                  <span
                    key={`${phone.start}-${phone.phone}-${index}`}
                    className={cx(
                      "rounded-full border px-3 py-2 text-xs font-black",
                      phone.status === "retry"
                        ? "border-[#FB7185]/30 bg-[#FB7185]/10 text-[#FDA4AF]"
                        : "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FDE68A]",
                    )}
                    title={phone.feedback}
                  >
                    /{phone.displayPhone}/ {phone.word ? `· ${phone.word}` : ""}
                  </span>
                ))}
            </div>
          </details>
        ) : null}

        {analysis.transcript ? (
          <details className="rounded-[28px] border border-white/10 bg-[#161228] p-5">
            <summary className="cursor-pointer text-sm font-black text-[#A78BFA]">Voir la transcription mesurée</summary>
            <p className="mt-4 text-sm leading-7 text-[#D8CCFF]">{analysis.transcript}</p>
          </details>
        ) : null}

        {analysis.segmentAnalyses?.length ? (
          <details className="rounded-[28px] border border-white/10 bg-[#161228] p-5">
            <summary className="cursor-pointer text-sm font-black text-[#A3E635]">Voir l’analyse phrase par phrase</summary>
            <div className="mt-4 space-y-3">
              {analysis.segmentAnalyses.map((segment) => (
                <div key={segment.segmentIndex} className="rounded-2xl bg-[#0D0A1A] p-4">
                  <p className="font-black">{segment.text}</p>
                  <p className="mt-2 text-sm leading-6 text-[#D8CCFF]">{segment.feedback}</p>
                  <p className="mt-2 text-xs font-bold text-[#9D8EC4]">
                    Diction {segment.dictionScore} · débit {segment.detectedWpm ?? "--"}/{segment.targetWpm}
                    {segment.actualPauseAfterMs === null ? "" : ` · silence ${Math.round(segment.actualPauseAfterMs)}/${segment.targetPauseAfterMs} ms`}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
        </details>
      </section>
    </div>
  );
}

function Progress({
  baseline,
  baselineAudioUrl,
  dimensions,
  history,
  totalXp,
}: {
  baseline: BaselineRecord | null;
  baselineAudioUrl: string | null;
  dimensions: VoiceDimension[];
  history: PracticeHistoryEntry[];
  totalXp: number;
}) {
  const chartEntries = [...history].reverse().slice(-12);
  const scores = history.map((entry) => entry.score);
  const bestScore = scores.length ? Math.max(...scores) : 0;
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const latestScore = history[0]?.score ?? 0;
  const latestDimensionScores = history.find((entry) => entry.dimensionScores)?.dimensionScores;
  const displayedDimensions: VoiceDimension[] = latestDimensionScores
    ? [
        { label: "Clarte", value: latestDimensionScores.clarity, hint: "Derniere prise valide" },
        { label: "Rythme", value: latestDimensionScores.rhythm, hint: "Derniere prise valide" },
        { label: "Intonation", value: latestDimensionScores.intonation, hint: "Derniere prise valide" },
        { label: "Expressivite", value: latestDimensionScores.expressiveness, hint: "Derniere prise valide" },
      ]
    : dimensions;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[36px] border border-white/10 bg-[#161228] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A3E635]">Historique reel</p>
        <h2 className="mt-2 text-3xl font-black">Ta progression vocale</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Dernier", latestScore ? `${latestScore}/100` : "--"],
            ["Meilleur", bestScore ? `${bestScore}/100` : "--"],
            ["Moyenne", averageScore ? `${averageScore}/100` : "--"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[#0D0A1A] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9D8EC4]">{label}</p>
              <p className="mt-1 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex h-64 items-end gap-3 rounded-[28px] bg-[#0D0A1A] p-4">
          {chartEntries.length === 0 ? (
            <div className="grid h-full w-full place-items-center text-center text-sm text-[#9D8EC4]">
              Fais une premiere analyse pour afficher ta progression.
            </div>
          ) : (
            chartEntries.map((entry, index) => (
              <div key={entry.id} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-xl bg-[#8B5CF6]" style={{ height: `${Math.max(8, entry.score)}%` }} />
                <span className="text-[10px] text-[#5B4F7A]">{index + 1}</span>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 space-y-2">
          {history.slice(0, 5).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#0D0A1A] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{entry.lessonTitle}</p>
                <p className="text-xs text-[#9D8EC4]">{entry.createdAt} - {entry.badge}</p>
              </div>
              <p className="shrink-0 text-lg font-black text-[#A3E635]">{entry.score}/100</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-5">
        {baseline ? (
          <div className="rounded-[36px] border border-[#A3E635]/25 bg-[#A3E635]/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#BEF264]">Point de depart conserve</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-black">{baseline.score}/100</p>
                <p className="mt-1 text-sm text-[#D9F99D]">Diagnostic initial</p>
              </div>
              <p className="text-right text-xs text-[#D9F99D]">Confiance {Math.round(baseline.confidence * 100)}%</p>
            </div>
            {baselineAudioUrl ? <audio className="mt-4 w-full" controls preload="metadata" src={baselineAudioUrl} /> : null}
          </div>
        ) : null}
        <div className="rounded-[36px] border border-white/10 bg-[#161228] p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FBBF24]">Radar vocal</p>
          <div className="mt-5 space-y-4">
            {displayedDimensions.map((dimension) => (
              <div key={dimension.label}>
                <div className="flex justify-between text-sm font-bold">
                  <span>{dimension.label}</span>
                  <span>{dimension.measured === false ? "--" : dimension.value}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#A3E635]" style={{ width: `${dimension.measured === false ? 0 : dimension.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[36px] border border-white/10 bg-[#161228] p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A78BFA]">Activite</p>
          <p className="mt-2 text-3xl font-black">{totalXp} XP</p>
          <p className="mt-1 text-sm text-[#9D8EC4]">{history.length} prise{history.length > 1 ? "s" : ""} analysee{history.length > 1 ? "s" : ""}</p>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, index) => (
              <span
                key={index}
                className={cx("aspect-square rounded-lg", index < history.length ? "bg-[#A3E635]" : index % 3 === 0 ? "bg-[#8B5CF6]/45" : "bg-white/10")}
              />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Badges({ analysis, streak }: { analysis: AnalysisResult | null; streak: number }) {
  const hasScoredAnalysis = analysis?.analysisStatus === "scored";
  const badges = [
    { title: "Premiere prise", status: "earned", hint: "Tu as lance ton premier studio." },
    { title: hasScoredAnalysis && analysis.badge ? analysis.badge : "Base solide", status: hasScoredAnalysis && analysis.badge ? "earned" : "progress", hint: hasScoredAnalysis && analysis.badge ? "Débloqué par ton score." : "Analyse une prise valide." },
    { title: "3 jours de suite", status: streak >= 3 ? "earned" : "progress", hint: `${Math.min(streak, 3)}/3 jours` },
    { title: "Hook glacant", status: "progress", hint: "Reussis un exercice horreur a 85+." },
    { title: "Voix documentaire", status: "locked", hint: "Reserve au parcours createur." },
    { title: "Menace calme", status: "locked", hint: "Reserve au parcours doublage." },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => (
        <div
          key={badge.title}
          className={cx(
            "rounded-[32px] border p-6",
            badge.status === "earned" && "border-[#A3E635]/50 bg-[#A3E635]/12",
            badge.status === "progress" && "border-[#8B5CF6]/45 bg-[#161228]",
            badge.status === "locked" && "border-white/10 bg-[#161228] opacity-55",
          )}
        >
          <div className="grid size-16 place-items-center rounded-3xl bg-[#0D0A1A] text-2xl font-black">
            {badge.status === "earned" ? "✓" : badge.status === "locked" ? "×" : "…"}
          </div>
          <h3 className="mt-5 text-2xl font-black">{badge.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#9D8EC4]">{badge.hint}</p>
          <span className="mt-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#A78BFA]">
            {badge.status}
          </span>
        </div>
      ))}
    </div>
  );
}
