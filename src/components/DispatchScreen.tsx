"use client";

import { useEffect, useState } from "react";
import { Assessment } from "@/lib/types";
import { MOCK_PROVIDERS, getProvidersForSeverity, Provider } from "@/lib/mock-providers";

const SEVERITY_CONFIG = {
  low: { color: "#00d4a0", label: "LOW RISK", bg: "#001a14" },
  medium: { color: "#ff6b35", label: "MODERATE RISK", bg: "#1a0e00" },
  high: { color: "#ff3b4e", label: "HIGH RISK", bg: "#1a0007" },
};

const CARE_ICONS: Record<string, string> = {
  telehealth: "📹",
  urgent_care: "🏥",
  er: "🚨",
  "911": "🚑",
};

export default function DispatchScreen({
  assessment,
  emergencyId,
  conversation,
  onConnect,
}: {
  assessment: Assessment;
  emergencyId: string;
  conversation: string;
  onConnect: (id: string, name: string) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [competing, setCompeting] = useState(false);
  const severity = SEVERITY_CONFIG[assessment.severity] ?? SEVERITY_CONFIG.medium;

  useEffect(() => {
    // Simulate reverse dispatch — providers "accepting" in sequence
    setCompeting(true);
    const all = getProvidersForSeverity(assessment.severity);
    let i = 0;
    const timer = setInterval(() => {
      if (i >= all.length) {
        clearInterval(timer);
        setCompeting(false);
        return;
      }
      setProviders((prev) => [...prev, all[i]]);
      i++;
    }, 600);
    return () => clearInterval(timer);
  }, [assessment.severity]);

  async function handleConnect(provider: Provider) {
    await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emergencyId,
        providerId: provider.id,
        providerName: provider.name,
      }),
    });
    onConnect(provider.id, provider.name);
  }

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full px-4 py-8 gap-6">
      {/* Risk Badge */}
      <div
        className="rounded-2xl p-5 slide-up"
        style={{ background: severity.bg, border: `1px solid ${severity.color}30` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="px-3 py-1 rounded-full text-xs font-bold tracking-widest"
            style={{ background: severity.color + "20", color: severity.color }}
          >
            {severity.label}
          </div>
          {assessment.severity === "high" && (
            <span className="text-xs blink" style={{ color: severity.color }}>
              ● URGENT
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#ccc" }}>
          {assessment.summary}
        </p>
        <div className="flex flex-wrap gap-2">
          {assessment.symptoms.map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-1 rounded-full"
              style={{ background: "#1e1e2e", color: "#aaa" }}
            >
              {s}
            </span>
          ))}
        </div>
        {assessment.patient_age && (
          <div className="mt-3 text-xs" style={{ color: "#666" }}>
            Patient: {assessment.patient_age}yo
            {assessment.onset_minutes
              ? ` · Onset ${assessment.onset_minutes}min ago`
              : ""}
            {assessment.medications?.length
              ? ` · Meds: ${assessment.medications.join(", ")}`
              : ""}
          </div>
        )}
      </div>

      {/* Inngest badge */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
        style={{ background: "#0d0d1a", border: "1px solid #1e1e3a", color: "#666" }}
      >
        <span style={{ color: "#3b82f6" }}>⚡</span>
        Inngest workflow triggered · Emergency ID:{" "}
        <code style={{ color: "#888" }}>{emergencyId.slice(0, 8)}</code>
        <span style={{ color: "#3b82f6" }} className="ml-auto">
          Notifying providers →
        </span>
      </div>

      {/* Providers competing */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            {competing ? "Providers responding..." : "Choose your care"}
          </h2>
          {competing && (
            <span className="text-xs blink" style={{ color: "#3b82f6" }}>
              ●
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {providers.map((p, i) => (
            <div
              key={p.id}
              className="slide-up rounded-2xl p-4 flex items-center gap-4"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{
                  background:
                    p.type === "er"
                      ? "#1a0007"
                      : p.type === "urgent_care"
                      ? "#1a0e00"
                      : "#001a14",
                  color:
                    p.type === "er"
                      ? "var(--pulse-red)"
                      : p.type === "urgent_care"
                      ? "var(--pulse-orange)"
                      : "var(--pulse-green)",
                }}
              >
                {CARE_ICONS[p.type] ?? "🏥"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                  {p.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#666" }}>
                  {p.specialty} · ⭐ {p.rating}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-xs font-semibold" style={{ color: "var(--pulse-green)" }}>
                  ETA {p.eta} min
                </div>
                <button
                  onClick={() => handleConnect(p)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                  style={{
                    background:
                      p.type === "er" ? "var(--pulse-red)" : "var(--pulse-green)",
                    color: "white",
                  }}
                >
                  {p.type === "er" ? "Call ER" : "Connect"}
                </button>
              </div>
            </div>
          ))}

          {competing && providers.length === 0 && (
            <div
              className="rounded-2xl p-4 text-center text-sm"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "#666" }}
            >
              <span className="blink">●</span> Dispatching to provider network...
            </div>
          )}
        </div>
      </div>

      {/* Parallel dispatch callout */}
      <div
        className="rounded-xl p-4 text-xs"
        style={{ background: "#0d0d1a", border: "1px solid #1e1e3a" }}
      >
        <div className="font-semibold mb-2" style={{ color: "#888" }}>
          Parallel dispatch active
        </div>
        <div className="flex gap-4">
          {["✓ Doctor network", "✓ Family alert", "✓ Telehealth queue"].map((item) => (
            <span key={item} style={{ color: "var(--pulse-green)" }}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
