"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ChevronUp, ChevronDown } from "lucide-react";
import { detectLoop, type LoopLevel } from "@/lib/loop-detection";
import { getGrounding } from "@/lib/topic-map";
import type { Memory } from "@/lib/mock-memories";
import type { Alert, Message } from "@/lib/types";
import GoldenFlower from "@/components/GoldenFlower";
import { isDemoMode } from "@/lib/env";
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

const SPEECH_END_MS = 380;
const PCM_SAMPLE_RATE = 22050;
const CONTEXT_MESSAGE_LIMIT = 12;

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

/** Earliest speakable break so TTS starts before a full sentence completes */
function findFirstChunkBreak(text: string): number {
  if (text.length < 8) return 0;
  for (const ch of [",", "—", "–"]) {
    const i = text.indexOf(ch);
    if (i >= 6 && i <= 30) return i + 1;
  }
  const punct = text.search(/[.!?]/);
  if (punct >= 6 && punct <= 36) return punct + 1;
  if (text.length >= 10) {
    const space = text.lastIndexOf(" ", Math.min(18, text.length));
    if (space >= 8) return space;
  }
  return 0;
}

/** Split speakable chunks — first chunk is aggressive for low latency */
function getReadyChunks(text: string, streaming: boolean): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const sentences: string[] = [];
  let rest = clean;
  const re = /^(.+?[.!?])(?:\s+|$)/;

  while (rest) {
    const m = rest.match(re);
    if (!m) break;
    sentences.push(m[1].trim());
    rest = rest.slice(m[0].length).trim();
  }

  if (streaming && !sentences.length) {
    const br = findFirstChunkBreak(rest);
    if (br > 0) {
      sentences.push(rest.slice(0, br).trim());
    }
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
      <div style={{ fontSize: 12, color: "#b0a480", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Need a moment?</div>
      <div style={{ fontSize: 14, color: "#17110a", marginBottom: 16, lineHeight: 1.5 }}>
        It&apos;s okay to pause. Here are a few gentle ways to shift the conversation:
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
  const [voiceLabel, setVoiceLabel] = useState<string | null>(null);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalSpeechRef = useRef("");
  const listenAbortRef = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speakGenRef    = useRef(0);
  const ttsCacheRef    = useRef<Map<string, Promise<Blob | null>>>(new Map());
  const pcmCtxRef      = useRef<AudioContext | null>(null);
  const pcmEndRef      = useRef(0);
  const callActiveRef  = useRef(false);
  const mutedRef       = useRef(false);

  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!isDemoMode()) return;
    fetch("/api/voice/config")
      .then((r) => r.json())
      .then((cfg: { provider?: string; model?: string; stt?: string }) => {
        if (cfg.provider === "elevenlabs") {
          setVoiceLabel(`ElevenLabs ${cfg.model ?? "flash"} · ${cfg.stt ?? "mic"}`);
        } else if (cfg.provider === "xai") {
          setVoiceLabel("Grok voice · mic");
        }
      })
      .catch(() => {});
  }, []);

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
    clearTimeout(silenceTimerRef.current);
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

  const startGrokRecording = useCallback(async () => {
    try {
      listenAbortRef.current = false;
      finalSpeechRef.current = "";
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
        if (!res.ok) {
          setLiveTranscript("couldn't hear you — tap the mic and try again");
          return;
        }
        const { text } = await res.json();
        if (text?.trim()) send(text);
        else setLiveTranscript("didn't catch that — tap the mic and try again");
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setListening(true);
      setLiveTranscript("listening…");
      listenTimerRef.current = setTimeout(() => stopVoice(), 12000);
    } catch {
      setListening(false);
      setLiveTranscript("mic blocked — allow microphone in browser settings");
    }
  }, [stopVoice]); // eslint-disable-line

  const startVoice = useCallback(async () => {
    if (mutedRef.current || listening || loading || speaking) return;

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (SpeechRecognitionCtor) {
      listenAbortRef.current = false;
      finalSpeechRef.current = "";
      let submitted = false;
      setLiveTranscript("");
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      const submitSpeech = (text: string) => {
        if (submitted) return;
        const trimmed = text.trim();
        if (trimmed.length < 2) return;
        submitted = true;
        listenAbortRef.current = true;
        clearTimeout(silenceTimerRef.current);
        finalSpeechRef.current = "";
        setLiveTranscript("");
        setListening(false);
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
        send(trimmed);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalSpeechRef.current += chunk;
          else interim += chunk;
        }
        const live = (finalSpeechRef.current + interim).trim();
        setLiveTranscript(live);

        const last = event.results[event.results.length - 1];
        if (!submitted && last?.isFinal && live.length >= 2) {
          submitSpeech(live);
          return;
        }

        clearTimeout(silenceTimerRef.current);
        if (!submitted && live.length >= 2) {
          silenceTimerRef.current = setTimeout(() => submitSpeech(live), SPEECH_END_MS);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        recognitionRef.current = null;
        clearTimeout(silenceTimerRef.current);
        setListening(false);
        if (event.error === "aborted") return;
        startGrokRecording();
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        clearTimeout(silenceTimerRef.current);
        setListening(false);
        if (listenAbortRef.current || submitted) {
          listenAbortRef.current = false;
          return;
        }
        const text = finalSpeechRef.current.trim();
        finalSpeechRef.current = "";
        setLiveTranscript("");
        if (text.length >= 2) submitSpeech(text);
      };

      try {
        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
        setLiveTranscript("listening…");
      } catch {
        startGrokRecording();
      }
      return;
    }

    await startGrokRecording();
  }, [listening, loading, speaking, stopVoice, startGrokRecording]); // eslint-disable-line

  const resumeListening = useCallback(() => {
    if (!mutedRef.current && callActiveRef.current) startVoice();
  }, [startVoice]);

  const ensurePcmCtx = useCallback(async () => {
    if (!pcmCtxRef.current) {
      pcmCtxRef.current = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
    }
    if (pcmCtxRef.current.state === "suspended") {
      await pcmCtxRef.current.resume();
    }
    return pcmCtxRef.current;
  }, []);

  const speakStreamingPcm = useCallback(async (text: string, gen: number): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    try {
      const res = await fetch("/api/voice/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok || !res.body) return false;

      const ctx = await ensurePcmCtx();
      const reader = res.body.getReader();
      let scheduleAt = Math.max(ctx.currentTime + 0.02, pcmEndRef.current);
      setSpeaking(true);

      let pending = 0;
      await new Promise<void>((resolve) => {
        const doneOne = () => {
          pending--;
          if (pending <= 0) resolve();
        };

        (async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (gen !== speakGenRef.current) {
              resolve();
              return;
            }
            if (!value?.byteLength) continue;

            const samples = new Int16Array(
              value.buffer,
              value.byteOffset,
              value.byteLength / 2
            );
            if (!samples.length) continue;

            const floats = new Float32Array(samples.length);
            for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 32768;

            const buf = ctx.createBuffer(1, floats.length, PCM_SAMPLE_RATE);
            buf.copyToChannel(floats, 0);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            pending++;
            src.onended = doneOne;
            src.start(scheduleAt);
            scheduleAt += buf.duration;
            pcmEndRef.current = scheduleAt;
          }
          if (pending === 0) resolve();
        })().catch(() => resolve());
      });

      if (gen === speakGenRef.current) setSpeaking(false);
      return gen === speakGenRef.current;
    } catch {
      return false;
    }
  }, [ensurePcmCtx]);

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
    const phrases = [...GREETINGS.slice(0, 2), ...CALL_BRIDGES];
    let cancelled = false;
    (async () => {
      for (const phrase of phrases) {
        if (cancelled) break;
        await fetchTtsBlob(phrase).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
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
        audio.oncanplay = play;
        audio.load();
      }
    });
  }, []);

  const speakText = useCallback(async (text: string, gen: number): Promise<void> => {
    if (gen !== speakGenRef.current || !text.trim()) return;

    const streamed = await speakStreamingPcm(text, gen);
    if (streamed && gen === speakGenRef.current) return;

    const blob = await fetchTtsBlob(text);
    if (gen !== speakGenRef.current) return;
    if (blob) {
      await playBlob(blob, gen);
      return;
    }
    speakWithBrowser(text);
  }, [speakStreamingPcm, fetchTtsBlob, playBlob, speakWithBrowser]);

  async function speak(text: string, onDone?: () => void) {
    if (speakerOff) { onDone?.(); return; }
    stopVoice(true);
    const gen = ++speakGenRef.current;
    stopSpeaking(false);
    pcmEndRef.current = 0;
    await speakText(text, gen);
    if (gen === speakGenRef.current) onDone?.();
  }

  function stopSpeaking(bumpGen = true) {
    if (bumpGen) speakGenRef.current += 1;
    pcmEndRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (pcmCtxRef.current) {
      pcmCtxRef.current.close().catch(() => {});
      pcmCtxRef.current = null;
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
    setMessages(next);
    setLoading(true);

    const gen = ++speakGenRef.current;
    pcmEndRef.current = 0;
    const chunkTexts: string[] = [];
    let streamDone = false;
    const contextMessages = next.slice(-CONTEXT_MESSAGE_LIMIT);

    const queueChunk = (i: number, chunk: string) => {
      chunkTexts[i] = chunk;
    };

    const player = (async () => {
      let idx = 0;
      while (idx < chunkTexts.length || !streamDone) {
        while (idx >= chunkTexts.length && !streamDone) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
        if (idx >= chunkTexts.length) break;
        if (gen !== speakGenRef.current) return;
        await speakText(chunkTexts[idx], gen);
        idx++;
      }
      if (gen === speakGenRef.current && !mutedRef.current && callActiveRef.current) startVoice();
    })();

    const res = await fetch("/api/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: contextMessages, loopLevel: currentLoop, memories }),
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
    const fam = memories.filter((m) => m.type === "family").at(-1)
      ?? memories.find((m) => m.type === "voice")
      ?? memories[0];
    if (!fam) return;
    const from = fam.type === "family" ? "Sarah wanted me to tell you" : "I have a message from your family";
    speak(`${from}: ${fam.content}`, resumeListening);
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

  function greetingWithFamilyNotes(base: string): string {
    if (messages.length > 0) return base;
    const family = memories.filter((m) => m.type === "family");
    if (!family.length) return base;
    const note = family[family.length - 1];
    return `${base} Oh — and Sarah wanted me to pass something along. She said: ${note.content}`;
  }

  function answerCall() {
    callActiveRef.current = true;
    setCallActive(true);
    setDemoStatus(null);
    void ensurePcmCtx();
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "started" }),
    });
    const base = messages.length > 0
      ? "Hi Margaret, it's evora again. I'm right here — what would you like to talk about?"
      : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    speak(greetingWithFamilyNotes(base), resumeListening);
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
      setDemoStatus(
        data.interactive
          ? `Ringing ${data.to} — answer and talk with evora!`
          : `Ringing ${data.to} — set NEXT_PUBLIC_APP_URL (ngrok) for a live two-way phone call`
      );
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
    loading   ? "I'm thinking…" :
    speaking  ? "evora is speaking" :
    listening ? "I'm listening" :
    "Connected";

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const showLivePanel = listening || liveTranscript || messages.length > 0 || loading || speaking;
  const latestFamilyNote = memories.filter((m) => m.type === "family").at(-1);

  // ── IDLE ─────────────────────────────────────────────────────────────────────
  if (!callActive) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        minHeight: "100dvh", alignItems: "center", justifyContent: "center",
        background: patientTheme.bg, padding: "56px 24px 48px",
      }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ marginBottom: 24, filter: "drop-shadow(0 8px 24px rgba(196,154,48,0.14))" }}
        >
          <GoldenFlower size={88} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          style={{ textAlign: "center", marginBottom: 20, maxWidth: 320 }}
        >
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#17110a", marginBottom: 8 }}>evora</div>
          <div style={{ fontSize: 15, color: patientTheme.muted, lineHeight: 1.55 }}>
            A friend who&apos;s always here to listen
          </div>
        </motion.div>

        <GroundingCard />

        {latestFamilyNote && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            style={{
              marginTop: 20, maxWidth: 340, width: "100%",
              padding: "14px 16px", borderRadius: 16,
              background: "white",
              border: "1px solid rgba(196,92,92,0.15)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#c45c5c", marginBottom: 6 }}>
              Message from family
            </div>
            <div style={{ fontSize: 13, color: "#5a4a30", lineHeight: 1.55 }}>
              {latestFamilyNote.content}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          style={{
            marginTop: 24, width: "100%", maxWidth: 360,
            padding: "18px 16px 16px", borderRadius: 20,
            background: "white",
            border: "1px solid rgba(196,154,48,0.12)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#a07830", marginBottom: 12, textAlign: "center" }}>
            Not sure what to say?
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => startWithPhrase(s)}
                style={{
                  padding: "10px 14px", borderRadius: 100, fontSize: 13, cursor: "pointer",
                  background: patientTheme.bg, color: "#7a5a20",
                  border: "1px solid rgba(196,154,48,0.2)",
                  lineHeight: 1.35,
                  minHeight: 44,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 22 }}
          style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={answerCall}
            aria-label="Start conversation with evora"
            style={{
              width: 84, height: 84, borderRadius: "50%", border: "none",
              background: "linear-gradient(145deg, #1a9e5c, #22c870)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 10px 32px rgba(34,200,112,0.35), 0 0 0 6px rgba(34,200,112,0.12)",
            }}
          >
            <Phone size={32} color="white" fill="white" />
          </motion.button>
          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: "#17110a", textAlign: "center" }}>
            Start conversation
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: patientTheme.muted, textAlign: "center" }}>
            Tap the button, then speak when you&apos;re ready
          </div>
        </motion.div>

        {isDemoMode() && voiceLabel && (
          <div style={{ marginTop: 20, fontSize: 10, color: "#a89878", textAlign: "center" }}>
            {voiceLabel}
          </div>
        )}

        {isDemoMode() && (
          <>
            <button
              onClick={triggerDemoPhoneCall}
              disabled={demoCalling}
              style={{
                marginTop: 24, background: "none", border: "none", cursor: demoCalling ? "wait" : "pointer",
                fontSize: 11, color: "#c0b090", textDecoration: "underline", textUnderlineOffset: 3,
              }}
            >
              {demoCalling ? "calling your phone…" : "demo phone call"}
            </button>

            {demoStatus && (
              <div style={{
                marginTop: 10, fontSize: 11, textAlign: "center", maxWidth: 280, lineHeight: 1.5,
                color: demoStatus.includes("Ringing") ? "#059669" : "#b45309",
              }}>
                {demoStatus}
              </div>
            )}
          </>
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
          <BreathingExercise onDone={() => { setShowBreathing(false); resumeListening(); }} />
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
          <div style={{ fontSize: 13, color: "#b0a480", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
            {fmt(duration)}
          </div>
          {isDemoMode() && voiceLabel && (
            <div style={{ marginTop: 4, fontSize: 10, color: "#c4b896" }}>{voiceLabel}</div>
          )}
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
                  Listening
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
            {showTranscript ? "Hide conversation" : "View full conversation"}
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
