"use client";

import { useState, useRef, useEffect } from "react";
import { Assessment } from "@/lib/types";

type Message = { role: "user" | "assistant"; content: string };

function unwrapJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.content === "string") return parsed.content;
    if (typeof parsed?.text === "string") return parsed.text;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {}
  return text;
}

function parseAssessment(text: string): Assessment | null {
  const match = text.match(/<assessment>([\s\S]*?)<\/assessment>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export default function IntakeScreen({
  onAssessment,
}: {
  onAssessment: (a: Assessment, id: string, conv: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (listening || loading) return;
      e.preventDefault();
      startVoice();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      recognitionRef.current?.stop();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [listening, loading]);

  async function send(text: string) {
    if (!text.trim()) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStarted(true);

    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    const assistantIdx = newMessages.length;

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value);
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = { role: "assistant", content: unwrapJson(full) };
        return updated;
      });
    }

    setLoading(false);

    // Check if assessment is complete
    const assessment = parseAssessment(full);
    if (assessment) {
      // Dispatch to Inngest
      const dispatchRes = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment,
          conversation: newMessages.map((m) => `${m.role}: ${m.content}`).join("\n"),
        }),
      });
      const { emergencyId } = await dispatchRes.json();

      setTimeout(() => {
        onAssessment(
          assessment,
          emergencyId,
          newMessages.map((m) => `${m.role}: ${m.content}`).join("\n")
        );
      }, 1200);
    }
  }

  function startVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice not supported in this browser. Use Chrome.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      send(transcript);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
    recognitionRef.current = rec;
  }

  const visibleMessages = messages.filter((m) => !m.content.includes("<assessment>"));

  return (
    <div className="flex flex-col flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      {!started ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-8 text-center">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: "#1a0a0a", border: "2px solid var(--pulse-red)" }}
            >
              <span className="text-4xl">🫀</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              What&apos;s the emergency?
            </h1>
            <p style={{ color: "#666" }}>
              Describe what&apos;s happening. Grok will guide you through the rest.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-md">
            <button
              onClick={startVoice}
              disabled={listening}
              className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-semibold text-white transition-all"
              style={{
                background: listening ? "#3a0010" : "var(--pulse-red)",
                opacity: listening ? 0.8 : 1,
              }}
            >
              {listening ? (
                <>
                  <span className="blink">●</span> Listening...
                </>
              ) : (
                <>🎙️ Speak the emergency</>
              )}
            </button>
            <div className="flex gap-2">
              <input
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                placeholder="Or type what's happening..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
              />
              <button
                onClick={() => send(input)}
                className="px-4 py-3 rounded-xl font-medium text-sm"
                style={{ background: "var(--pulse-red)", color: "white" }}
              >
                →
              </button>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            {["Chest pain", "Can't breathe", "Stroke symptoms", "Severe fall"].map((ex) => (
              <button
                key={ex}
                onClick={() => send(ex)}
                className="px-3 py-1.5 rounded-full text-xs border transition-all hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "#888" }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 gap-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full blink" style={{ background: "var(--pulse-red)" }} />
            <span className="text-xs" style={{ color: "#666" }}>
              Grok Voice Intake Active
            </span>
          </div>

          <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
            {visibleMessages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} slide-up`}
              >
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: m.role === "user" ? "var(--pulse-red)" : "var(--card-bg)",
                    color: m.role === "user" ? "white" : "var(--foreground)",
                    border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-2xl text-sm"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
                >
                  <span className="blink">●●●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={startVoice}
              disabled={listening || loading}
              className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: listening ? "#3a0010" : "var(--card-bg)",
                border: "1px solid var(--border)",
                color: listening ? "var(--pulse-red)" : "#888",
              }}
            >
              {listening ? "🔴 Listening" : "🎙️"}
            </button>
            <input
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="Reply..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-3 rounded-xl font-medium text-sm"
              style={{ background: "var(--pulse-red)", color: "white", opacity: loading ? 0.5 : 1 }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
