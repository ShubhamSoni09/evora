"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react";
import { detectLoop, type LoopLevel } from "@/lib/loop-detection";
import { getGrounding } from "@/lib/topic-map";
import type { Memory } from "@/lib/mock-memories";
import type { Alert, Message } from "@/lib/types";
import GoldenFlower from "@/components/GoldenFlower";
import { PATIENT_PHONE } from "@/lib/patient";
import { DOMAINS } from "@/lib/domains";

const patientTheme = DOMAINS.patient;
const LISTEN_COLOR = "#4a9e7a";
const LISTEN_GLOW = "rgba(74,158,122,0.35)";

const GREETINGS = [
  "Hi Margaret, it's evora. I've been thinking about you — how are you feeling right now?",
  "Hello Margaret, it's me. What's been on your mind today?",
  "Hi there Margaret — I'm so glad we're talking. How has your afternoon been?",
  "Hey Margaret, it's evora. I was just wondering how you're doing. Tell me what's going on with you.",
];

const CALL_BRIDGES = [
  "I'm right here with you.",
  "Take your time — I'm listening.",
  "Mm, I'm glad you told me that.",
];

const STARTERS = [
  "I feel a little lonely today",
  "I can't remember if I took my medicine",
  "Tell me about the rose garden",
  "I miss Harold",
];

// ─── helpers ─────────────────────────────────────────────────────────────────
function parseEscalation(text: string) {
  const m = text.match(/<escalate\s+severity="([^"]+)"\s+reason="([^"]+)"\s*\/>/);
  return m ? { severity: m[1], reason: m[2] } : null;
}
function stripMeta(text: string) { return text.replace(/<escalate[^/]*\/>/g, "").trim(); }
function unwrapJson(text: string) {
  try {
    const p = JSON.parse(text);
    if (typeof p?.content === "string") return p.content;
    if (typeof p?.text   === "string") return p.text;
    if (typeof p?.message === "string") return p.message;
  } catch {}
  return text;
}
function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2,"0")}:${(s % 60).toString().padStart(2,"0")}`;
}

/** Split off complete spoken sentences; leave trailing fragment while still streaming */
function getReadyChunks(text: string, streaming: boolean): string[] {
  const sentences: string[] = [];
  let rest = text.trim();
  const re = /^(.+?[.!?])(?:\s+|$)/;
  while (rest) {
    const m = rest.match(re);
    if (!m) break;
    sentences.push(m[1].trim());
    rest = rest.slice(m[0].length).trim();
  }
  if (!streaming && rest) sentences.push(rest);
  return sentences;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Orb ─────────────────────────────────────────────────────────────────────
function EvoraOrb({ size, speaking, listening }: { size: number; speaking: boolean; listening: boolean }) {
  return (
    <motion.div
      animate={
        speaking  ? { boxShadow: ["0 0 0 0px rgba(196,154,48,0.6)", `0 0 0 ${Math.round(size * 0.18)}px rgba(196,154,48,0)`] }
        : listening ? { boxShadow: [`0 0 0 0px ${LISTEN_GLOW}`, `0 0 0 ${Math.round(size * 0.14)}px rgba(74,158,122,0)`] }
        : { boxShadow: "0 4px 20px rgba(196,154,48,0.12)" }
      }
      transition={speaking || listening ? { repeat: Infinity, duration: 1.5, ease: "easeOut" } : { duration: 0.5 }}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "white",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        boxShadow: speaking || listening
          ? undefined
          : "0 4px 20px rgba(196,154,48,0.15), 0 0 0 1px rgba(196,154,48,0.12)",
      }}
    >
      <GoldenFlower size={size * 0.72} />
    </motion.div>
  );
}

// ─── Sound wave ───────────────────────────────────────────────────────────────
function SoundWave({ active, color }: { active: boolean; color: string }) {
  if (!active) return null;
  const heights = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 0.55, 0.85, 0.4];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
      {heights.map((h, i) => (
        <motion.div key={i}
          animate={{ scaleY: [h, h * 0.3 + 0.1, h * 1.1, h * 0.5, h] }}
          transition={{ repeat: Infinity, duration: 1.1 + i * 0.04, delay: i * 0.06, ease: "easeInOut" }}
          style={{ width: 3, borderRadius: 2, height: 24, transformOrigin: "center", background: color, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}

// ─── Breathing exercise ───────────────────────────────────────────────────────
function BreathingExercise({ onDone }: { onDone: () => void }) {
  const [phase, setPhase]   = useState<"in" | "hold" | "out">("in");
  const [cycle, setCycle]   = useState(1);
  const CYCLES = 4;

  useEffect(() => {
    const seq: ["in" | "hold" | "out", number][] = [["in",4000],["hold",2000],["out",4000]];
    let idx = 0;
    let t: ReturnType<typeof setTimeout>;
    function next() {
      const [p, dur] = seq[idx % 3];
      setPhase(p);
      if (idx > 0 && idx % 3 === 0) {
        const c = Math.floor(idx / 3) + 1;
        setCycle(c);
        if (c > CYCLES) { onDone(); return; }
      }
      idx++;
      t = setTimeout(next, dur);
    }
    next();
    return () => clearTimeout(t);
  }, [onDone]);

  const label = phase === "in" ? "breathe in..." : phase === "hold" ? "hold..." : "breathe out...";
  const scale = phase === "out" ? 1 : 1.45;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "absolute", inset: 0, zIndex: 20,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(180deg, #fffdf5 0%, #fff9ee 100%)",
        gap: 32,
      }}
    >
      <motion.div
        animate={{ scale }}
        transition={{ duration: phase === "hold" ? 0.1 : 4, ease: "easeInOut" }}
        style={{
          width: 160, height: 160, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(196,154,48,0.22) 0%, rgba(196,154,48,0.06) 70%, transparent 100%)",
          border: "2px solid rgba(196,154,48,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <motion.div
          animate={{ scale: scale * 0.65 }}
          transition={{ duration: phase === "hold" ? 0.1 : 4, ease: "easeInOut" }}
          style={{
            width: 160, height: 160, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,154,48,0.18) 0%, transparent 70%)",
          }}
        />
      </motion.div>

      <div style={{ textAlign: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{ fontSize: 20, fontWeight: 500, color: "#c49a30", letterSpacing: "-0.01em", marginBottom: 8 }}
          >
            {label}
          </motion.div>
        </AnimatePresence>
        <div style={{ fontSize: 12, color: "#b0a480" }}>cycle {cycle} of {CYCLES}</div>
      </div>

      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onDone}
        style={{
          padding: "10px 24px", borderRadius: 100, border: "none", cursor: "pointer",
          background: "rgba(0,0,0,0.05)", color: "#b0a480", fontSize: 13,
        }}
      >
        done
      </motion.button>
    </motion.div>
  );
}

// ─── Weather helper ───────────────────────────────────────────────────────────
function wmoToText(code: number): string {
  if (code === 0)  return "☀️ Sunny";
  if (code <= 2)   return "🌤 Partly Cloudy";
  if (code === 3)  return "☁️ Overcast";
  if (code <= 48)  return "🌫️ Foggy";
  if (code <= 57)  return "🌦 Drizzle";
  if (code <= 67)  return "🌧 Rainy";
  if (code <= 77)  return "❄️ Snowy";
  if (code <= 82)  return "🌦 Showers";
  if (code <= 86)  return "🌨 Snow Showers";
  if (code >= 95)  return "⛈ Thunderstorm";
  return "🌡️ Cloudy";
}

// ─── Grounding card (Lost-in-Time) ───────────────────────────────────────────
function GroundingCard() {
  const [weather, setWeather] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<ReturnType<typeof getGrounding> | null>(null);

  useEffect(() => {
    setGrounding(getGrounding());
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
            `&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`;
          const data = await fetch(url).then((r) => r.json());
          const code = data.current?.weather_code ?? -1;
          const temp = data.current?.temperature_2m;
          const label = wmoToText(code);
          setWeather(temp != null ? `${label} · ${Math.round(temp)}°F` : label);
        } catch {
          setWeather(null);
        }
      },
      () => {},
      { timeout: 6000 }
    );
  }, []);

  if (!grounding) return null;

  const items = [grounding.day, grounding.timeOfDay, grounding.date, weather].filter(Boolean) as string[];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center",
        padding: "4px 0 0",
      }}
    >
      {items.map((item, i) => (
        <span key={i} style={{
          fontSize: 11, padding: "5px 12px", borderRadius: 100,
          background: "rgba(196,154,48,0.08)",
          border: "1px solid rgba(196,154,48,0.18)",
          color: "#a07830", letterSpacing: "0.03em",
        }}>
          {item}
        </span>
      ))}
    </motion.div>
  );
}

// ─── Loop Breaker panel ───────────────────────────────────────────────────────
function LoopBreakerPanel({ memories, onBreath, onFamily, onDismiss }: {
  memories: Memory[];
  onBreath: () => void;
  onFamily: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      style={{
        width: "100%", maxWidth: 420,
        background: "white",
        border: "1px solid rgba(196,154,48,0.22)",
        borderRadius: 20,
        padding: "18px 20px",
        boxShadow: "0 4px 24px rgba(196,154,48,0.1), 0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 12, color: "#b0a480", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>loop breaker</div>
      <div style={{ fontSize: 14, color: "#17110a", marginBottom: 16, lineHeight: 1.5 }}>
        evora noticed a pattern. Try switching things up:
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <ModalityButton icon="🌬" label="Breathing" sub="calm down together" onClick={onBreath} />
        {memories.some(m => m.type === "family" || m.type === "voice") && (
          <ModalityButton icon="💌" label="Family" sub="hear from them" onClick={onFamily} />
        )}
        <ModalityButton icon="✓" label="Continue" sub="keep going" onClick={onDismiss} color="rgba(0,0,0,0.04)" textColor="#b0a480" />
      </div>
    </motion.div>
  );
}

function ModalityButton({ icon, label, sub, onClick, color = "rgba(196,154,48,0.1)", textColor = "#17110a" }: {
  icon: string; label: string; sub: string; onClick: () => void;
  color?: string; textColor?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.03 }}
      onClick={onClick}
      style={{
        flex: 1, padding: "12px 8px", borderRadius: 14, border: "none",
        background: color, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{label}</span>
      <span style={{ fontSize: 10, color: "#b0a480" }}>{sub}</span>
    </motion.button>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function EvoraChat({
  messages, setMessages, memories, onAlert,
}: {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  memories: Memory[];
  onAlert: (a: Omit<Alert, "id" | "timestamp">) => void;
}) {
  const [callActive, setCallActive]       = useState(false);
  const [muted, setMuted]                 = useState(false);
  const [speakerOff, setSpeakerOff]       = useState(false);
  const [listening, setListening]         = useState(false);
  const [speaking, setSpeaking]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [loopLevel, setLoopLevel]         = useState<LoopLevel>("none");
  const [duration, setDuration]           = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [loopDismissed, setLoopDismissed] = useState(false);
  const [demoCalling, setDemoCalling] = useState(false);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  const bottomRef      = useRef<HTMLDivElement>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalSpeechRef = useRef("");
  const listenAbortRef = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speakGenRef    = useRef(0);
  const ttsCacheRef    = useRef<Map<string, Promise<Blob | null>>>(new Map());

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    fetch("/api/session/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }).catch(() => {});
  }, [messages]);
  useEffect(() => {
    const level = detectLoop(messages);
    if (level !== loopLevel) {
      setLoopLevel(level);
      if (level === "high" || level === "medium") setLoopDismissed(false);
    }
  }, [messages, loopLevel]);
  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callActive]);

  const stopVoice = useCallback((abort = false) => {
    if (abort) listenAbortRef.current = true;
    clearTimeout(listenTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (abort) {
      setListening(false);
      setLiveTranscript("");
      finalSpeechRef.current = "";
    }
  }, []);

  useEffect(() => {
    if (!callActive) return;
    function onDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      if (!listening && !loading && !speaking && !muted) startVoice();
    }
    function onUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      stopVoice();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [callActive, listening, loading, speaking, muted]);

  useEffect(() => {
    if (loading || speaking || muted) {
      stopVoice(true);
    }
  }, [loading, speaking, muted, stopVoice]);

  const speakWithBrowser = useCallback((text: string, onDone?: () => void) => {
    if (!("speechSynthesis" in window)) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.88;
    utter.pitch = 1.02;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => { setSpeaking(false); onDone?.(); };
    utter.onerror = () => { setSpeaking(false); onDone?.(); };
    window.speechSynthesis.speak(utter);
  }, []);

  const startVoice = useCallback(async () => {
    if (muted || listening || loading || speaking) return;

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (SpeechRecognitionCtor) {
      listenAbortRef.current = false;
      finalSpeechRef.current = "";
      setLiveTranscript("");
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalSpeechRef.current += chunk;
          else interim += chunk;
        }
        setLiveTranscript((finalSpeechRef.current + interim).trim());
      };

      recognition.onerror = () => {
        setListening(false);
        setLiveTranscript("");
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setListening(false);
        if (listenAbortRef.current) {
          listenAbortRef.current = false;
          setLiveTranscript("");
          finalSpeechRef.current = "";
          return;
        }
        const text = finalSpeechRef.current.trim();
        setLiveTranscript("");
        finalSpeechRef.current = "";
        if (text) send(text);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      return;
    }

    try {
      listenAbortRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        clearTimeout(listenTimerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setListening(false);
        if (listenAbortRef.current) {
          listenAbortRef.current = false;
          setLiveTranscript("");
          return;
        }
        setLiveTranscript("");
        if (!chunks.length) return;
        setLiveTranscript("transcribing…");
        const blob = new Blob(chunks, { type: mime });
        const form = new FormData();
        form.append("file", blob, "audio.webm");
        const res = await fetch("/api/voice/stt", { method: "POST", body: form });
        setLiveTranscript("");
        if (!res.ok) return;
        const { text } = await res.json();
        if (text?.trim()) send(text);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setListening(true);
      setLiveTranscript("listening…");
      listenTimerRef.current = setTimeout(() => stopVoice(), 7000);
    } catch {
      setListening(false);
      setLiveTranscript("");
    }
  }, [muted, listening, loading, speaking, stopVoice]); // eslint-disable-line

  const fetchTtsBlob = useCallback(async (text: string): Promise<Blob | null> => {
    const key = text.trim();
    if (!key) return null;

    const cached = ttsCacheRef.current.get(key);
    if (cached) return cached;

    const promise = (async () => {
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: key }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || contentType.includes("application/json")) return null;
        return await res.blob();
      } catch {
        return null;
      }
    })();

    ttsCacheRef.current.set(key, promise);
    if (ttsCacheRef.current.size > 48) {
      const first = ttsCacheRef.current.keys().next().value;
      if (first) ttsCacheRef.current.delete(first);
    }
    return promise;
  }, []);

  useEffect(() => {
    if (callActive) return;
    for (const phrase of [...GREETINGS.slice(0, 2), ...CALL_BRIDGES]) {
      fetchTtsBlob(phrase).catch(() => {});
    }
  }, [callActive, fetchTtsBlob]);

  const playBlob = useCallback((blob: Blob, gen: number): Promise<void> => {
    return new Promise((resolve) => {
      if (gen !== speakGenRef.current) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.volume = 0.92;
      audioRef.current = audio;
      const finish = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        resolve();
      };
      audio.onplay = () => setSpeaking(true);
      audio.onended = finish;
      audio.onerror = finish;
      const play = () => audio.play().catch(finish);
      if (audio.readyState >= 2) play();
      else {
        audio.oncanplaythrough = play;
        audio.load();
      }
    });
  }, []);

  async function speak(text: string, onDone?: () => void) {
    if (speakerOff) { onDone?.(); return; }
    stopVoice(true);
    const gen = ++speakGenRef.current;
    stopSpeaking(false);
    const blob = await fetchTtsBlob(text);
    if (gen !== speakGenRef.current) return;
    if (blob) {
      await playBlob(blob, gen);
      if (gen === speakGenRef.current) onDone?.();
      return;
    }
    speakWithBrowser(text, onDone);
  }

  function stopSpeaking(bumpGen = true) {
    if (bumpGen) speakGenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  async function send(text: string) {
    if (!text.trim()) return;
    stopSpeaking();
    stopVoice(true);
    setLiveTranscript("");
    const currentLoop = detectLoop(messages);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next); setLoading(true);

    const gen = ++speakGenRef.current;
    const chunkTexts: string[] = [];
    const chunkPrefetches = new Map<number, Promise<Blob | null>>();
    let streamDone = false;

    const queueChunk = (i: number, chunk: string) => {
      chunkTexts[i] = chunk;
      chunkPrefetches.set(i, fetchTtsBlob(chunk));
    };

    const player = (async () => {
      let idx = 0;
      while (idx < chunkTexts.length || !streamDone) {
        while (!chunkPrefetches.has(idx) && !streamDone) await sleep(8);
        if (!chunkPrefetches.has(idx)) break;
        if (gen !== speakGenRef.current) return;
        const blob = await chunkPrefetches.get(idx)!;
        if (gen !== speakGenRef.current) return;
        if (blob) await playBlob(blob, gen);
        else speakWithBrowser(chunkTexts[idx]);
        idx++;
        if (idx < chunkTexts.length) {
          const next = chunkPrefetches.get(idx);
          if (next) next.catch(() => {});
        }
      }
      if (gen === speakGenRef.current && !muted && callActive) startVoice();
    })();

    const res = await fetch("/api/conversation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next, loopLevel: currentLoop, memories }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    const idx = next.length;
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      const clean = stripMeta(unwrapJson(full));
      setMessages(prev => { const u = [...prev]; u[idx] = { role: "assistant", content: clean }; return u; });

      const ready = getReadyChunks(clean, true);
      for (let i = chunkTexts.length; i < ready.length; i++) {
        queueChunk(i, ready[i]);
        if (i === 0) setLoading(false);
      }
    }

    full += decoder.decode();
    const finalClean = stripMeta(unwrapJson(full));
    setMessages(prev => { const u = [...prev]; u[idx] = { role: "assistant", content: finalClean }; return u; });

    const allChunks = getReadyChunks(finalClean, false);
    for (let i = chunkTexts.length; i < allChunks.length; i++) {
      queueChunk(i, allChunks[i]);
    }
    streamDone = true;
    setLoading(false);

    await player;

    const esc = parseEscalation(full);
    if (esc) {
      onAlert({ severity: esc.severity as Alert["severity"], reason: esc.reason });
      const conversation = next
        .concat([{ role: "assistant" as const, content: finalClean }])
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...esc, conversation }),
      });
    }
  }

  function deliverFamilyMessage() {
    const fam = memories.find(m => m.type === "family") ?? memories.find(m => m.type === "voice") ?? memories[0];
    if (!fam) return;
    const text = `I have a message from your family. ${fam.content}`;
    speak(text, () => { if (!muted && callActive) startVoice(); });
  }

  function startWithPhrase(phrase: string) {
    setCallActive(true);
    setDemoStatus(null);
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "started" }),
    });
    speak(CALL_BRIDGES[Math.floor(Math.random() * CALL_BRIDGES.length)], () => send(phrase));
  }

  function answerCall() {
    setCallActive(true);
    setDemoStatus(null);
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "started" }),
    });
    const greeting = messages.length > 0
      ? "Hi Margaret, it's evora again. I'm right here — what would you like to talk about?"
      : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    speak(greeting, () => { if (!muted && callActive) startVoice(); });
  }

  async function triggerDemoPhoneCall() {
    setDemoCalling(true);
    setDemoStatus(null);
    try {
      const res = await fetch("/api/call-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          immediate: true,
          greeting:
            "Hi Margaret, it's evora. I just wanted to hear your voice and see how you're doing. What's on your mind?",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDemoStatus(data.error ?? "Call failed — check Twilio keys in .env.local");
        return;
      }
      setDemoStatus(`Ringing ${data.to} — answer your phone to hear evora!`);
    } catch {
      setDemoStatus("Could not place call. Is the dev server running?");
    } finally {
      setDemoCalling(false);
    }
  }

  function hangUp() {
    stopSpeaking();
    stopVoice(true);
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ended", duration }),
    });
    setCallActive(false); setListening(false); setLoading(false);
    setLiveTranscript("");
    setLoopDismissed(false); setShowBreathing(false);
  }

  const showLoopBreaker = callActive && (loopLevel === "high" || loopLevel === "medium") && !loopDismissed && !showBreathing;
  const callStatus =
    loading   ? "thinking..." :
    speaking  ? "evora is speaking" :
    listening ? "your turn — speak when ready" :
    "connected";

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const showLivePanel = listening || liveTranscript || messages.length > 0 || loading || speaking;

  // ── IDLE ─────────────────────────────────────────────────────────────────────
  if (!callActive) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        minHeight: "100dvh", alignItems: "center", justifyContent: "center",
        background: patientTheme.bg, padding: "48px 28px 80px",
      }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ marginBottom: 20, filter: "drop-shadow(0 6px 16px rgba(217,119,6,0.18))" }}
        >
          <GoldenFlower size={96} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          style={{ textAlign: "center", marginBottom: 16 }}
        >
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", color: "#17110a", marginBottom: 6 }}>evora</div>
          <div style={{ fontSize: 14, color: patientTheme.muted }}>just talk — I'm listening</div>
        </motion.div>

        <GroundingCard />

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
          style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 340, margin: "24px 0 28px" }}
        >
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => startWithPhrase(s)}
              style={{
                padding: "7px 13px", borderRadius: 100, fontSize: 11.5, cursor: "pointer",
                background: "white", color: "#8a6a28",
                border: "1px solid rgba(196,154,48,0.22)",
              }}
            >
              {s}
            </button>
          ))}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28, type: "spring", stiffness: 300, damping: 22 }}
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={answerCall}
          style={{
            width: 76, height: 76, borderRadius: "50%", border: "none",
            background: "linear-gradient(135deg, #1a9e5c, #22c870)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 8px 28px rgba(34,200,112,0.38)",
          }}
        >
          <Phone size={30} color="white" fill="white" />
        </motion.button>

        <div style={{ marginTop: 14, fontSize: 12, color: patientTheme.muted, textAlign: "center" }}>
          tap to talk with evora
        </div>

        <button
          onClick={triggerDemoPhoneCall}
          disabled={demoCalling}
          style={{
            marginTop: 28, background: "none", border: "none", cursor: demoCalling ? "wait" : "pointer",
            fontSize: 11, color: "#c0b090", textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          {demoCalling ? "calling your phone…" : `demo phone call → ${PATIENT_PHONE}`}
        </button>

        {demoStatus && (
          <div style={{
            marginTop: 10, fontSize: 11, textAlign: "center", maxWidth: 280, lineHeight: 1.5,
            color: demoStatus.includes("Ringing") ? "#059669" : "#b45309",
          }}>
            {demoStatus}
          </div>
        )}

        {messages.length > 0 && (
          <div style={{
            position: "absolute", bottom: 36, fontSize: 12, color: "#b0a480",
            padding: "6px 14px", borderRadius: 100,
            background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)",
          }}>
            {messages.filter(m => m.role === "user").length} exchanges this session
          </div>
        )}
      </div>
    );
  }

  // ── IN CALL ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 95,
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      alignItems: "center",
      background: "linear-gradient(180deg, #fffdf5 0%, #fff9ee 100%)",
      padding: "0 28px",
      overflow: "hidden",
    }}>
      <AnimatePresence>
        {showBreathing && (
          <BreathingExercise onDone={() => { setShowBreathing(false); if (!muted && callActive) startVoice(); }} />
        )}
      </AnimatePresence>

      <div style={{ paddingTop: 80, width: "100%", display: "flex", justifyContent: "center", marginBottom: 52, flexShrink: 0 }}>
        <GroundingCard />
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
        marginBottom: 36,
      }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ marginBottom: 28 }}
        >
          <EvoraOrb size={140} speaking={speaking} listening={listening} />
        </motion.div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "#17110a", marginBottom: 8 }}>evora</div>
          <div style={{ fontSize: 13, color: "#b0a480", fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em" }}>
            {fmt(duration)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minHeight: 44 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={callStatus}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{ fontSize: 12, color: speaking ? "#b8840f" : listening ? LISTEN_COLOR : "#b0a480", letterSpacing: "0.04em" }}
            >
              {muted && !speaking ? "muted" : callStatus}
            </motion.div>
          </AnimatePresence>
          <SoundWave active={speaking || listening} color={speaking ? "#c49a30" : LISTEN_COLOR} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 12 }} />

      <AnimatePresence>
        {showLoopBreaker && (
          <LoopBreakerPanel
            memories={memories}
            onBreath={() => { setShowBreathing(true); setLoopDismissed(true); stopSpeaking(); stopVoice(); }}
            onFamily={() => { setLoopDismissed(true); stopSpeaking(); deliverFamilyMessage(); }}
            onDismiss={() => setLoopDismissed(true)}
          />
        )}
      </AnimatePresence>

      {showLivePanel && (
        <div style={{ width: "100%", maxWidth: 400, marginBottom: 28, padding: "0 4px", flexShrink: 0 }}>
          <div style={{
            padding: "18px 20px", borderRadius: 20,
            background: "white",
            border: `1px solid ${listening ? "rgba(74,158,122,0.25)" : "rgba(196,154,48,0.15)"}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}>
            {listening ? (
              <div style={{ marginBottom: (loading || lastAssistantMsg?.content) ? 18 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: LISTEN_COLOR, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  you · live
                </div>
                <div style={{ fontSize: 14, color: "#17110a", lineHeight: 1.7 }}>
                  {liveTranscript || "…"}
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9 }}
                    style={{ color: LISTEN_COLOR, marginLeft: 2 }}
                  >|</motion.span>
                </div>
              </div>
            ) : lastUserMsg ? (
              <div style={{ marginBottom: (loading || speaking || lastAssistantMsg?.content) ? 18 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#b8840f", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  you
                </div>
                <div style={{ fontSize: 14, color: "#17110a", lineHeight: 1.7 }}>{lastUserMsg.content}</div>
              </div>
            ) : null}

            {(loading || speaking || lastAssistantMsg?.content) && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: patientTheme.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  evora{loading && !lastAssistantMsg?.content ? " · thinking" : speaking ? " · speaking" : ""}
                </div>
                <div style={{ fontSize: 14, color: "#17110a", lineHeight: 1.7 }}>
                  {lastAssistantMsg?.content || "…"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {messages.length > 2 && (
        <div style={{ width: "100%", maxWidth: 480, marginBottom: 10, flexShrink: 0 }}>
          <button
            onClick={() => setShowTranscript(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 12, color: "#b0a480", padding: "6px 0",
            }}
          >
            {showTranscript ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {showTranscript ? "hide transcript" : "show transcript"}
          </button>
          <AnimatePresence>
            {showTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: "8px 0 4px" }}>
                  {messages.slice(-8).map((m, i) => (
                    <div key={i} style={{
                      maxWidth: "80%", padding: "7px 11px", fontSize: 12, lineHeight: 1.5,
                      color: "#17110a", alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      borderRadius: m.role === "assistant" ? "12px 12px 12px 3px" : "12px 12px 3px 12px",
                      background: m.role === "assistant" ? "rgba(196,154,48,0.08)" : "white",
                      border: m.role === "assistant" ? "1px solid rgba(196,154,48,0.16)" : "1px solid rgba(0,0,0,0.07)",
                    }}>
                      {m.content}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div style={{ paddingTop: 12, paddingBottom: 56, display: "flex", alignItems: "center", gap: 32, flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => {
            if (muted) { setMuted(false); return; }
            if (listening) stopVoice();
            else startVoice();
          }}
          style={{
            width: 58, height: 58, borderRadius: "50%", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            background: listening ? "rgba(74,158,122,0.14)" : muted ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.06)",
            color: listening ? LISTEN_COLOR : muted ? "#dc2626" : "#7a6040",
            boxShadow: listening ? `0 0 0 3px rgba(74,158,122,0.18)` : "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </motion.button>

        <motion.button whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }} onClick={hangUp}
          style={{
            width: 76, height: 76, borderRadius: "50%", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            background: "linear-gradient(135deg, #c42020, #e53535)", color: "white",
            boxShadow: "0 6px 24px rgba(196,32,32,0.4), 0 2px 8px rgba(196,32,32,0.28)",
          }}
        >
          <PhoneOff size={30} />
        </motion.button>

        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => { setSpeakerOff(v => !v); if (!speakerOff) stopSpeaking(); }}
          style={{
            width: 58, height: 58, borderRadius: "50%", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            background: speakerOff ? "rgba(220,38,38,0.1)" : "rgba(0,0,0,0.06)",
            color: speakerOff ? "#dc2626" : "#7a6040",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          {speakerOff ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </motion.button>
      </div>
    </div>
  );
}
