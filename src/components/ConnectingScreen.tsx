"use client";

import { useEffect, useState } from "react";
import { Assessment } from "@/lib/types";

type Phase = "connecting" | "accepted" | "briefing";

export default function ConnectingScreen({
  providerId,
  providerName,
  assessment,
  onReset,
}: {
  providerId: string;
  providerName: string;
  assessment: Assessment;
  onReset: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("connecting");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("accepted"), 2000);
    const t2 = setTimeout(() => setPhase("briefing"), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 gap-8">
      {phase === "connecting" && (
        <div className="flex flex-col items-center gap-4 slide-up">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
            style={{ background: "#1a0007", border: "2px solid var(--pulse-red)" }}
          >
            📡
          </div>
          <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Connecting to {providerName}
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full blink"
                style={{ background: "var(--pulse-red)", animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "accepted" && (
        <div className="flex flex-col items-center gap-4 slide-up">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
            style={{ background: "#001a14", border: "2px solid var(--pulse-green)" }}
          >
            ✓
          </div>
          <div className="text-lg font-semibold" style={{ color: "var(--pulse-green)" }}>
            {providerName} accepted
          </div>
          <div className="text-sm" style={{ color: "#666" }}>
            Sending patient briefing...
          </div>
        </div>
      )}

      {phase === "briefing" && (
        <div className="flex flex-col w-full max-w-lg gap-5 slide-up">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: "#001a14", border: "1px solid var(--pulse-green)" }}
            >
              ✓
            </div>
            <div>
              <div className="font-semibold" style={{ color: "var(--pulse-green)" }}>
                Connected — {providerName}
              </div>
              <div className="text-xs" style={{ color: "#666" }}>
                Doctor received briefing via Inngest workflow
              </div>
            </div>
          </div>

          {/* Doctor receives this briefing */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs font-bold tracking-widest mb-4" style={{ color: "#666" }}>
              PATIENT BRIEFING — SENT TO PROVIDER
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <Row label="Chief Complaint" value={assessment.symptoms.join(", ")} />
              {assessment.patient_age && <Row label="Patient" value={`${assessment.patient_age}yo`} />}
              {assessment.onset_minutes && (
                <Row label="Onset" value={`${assessment.onset_minutes} minutes ago`} />
              )}
              <Row
                label="Risk"
                value={assessment.severity.toUpperCase()}
                valueColor={
                  assessment.severity === "high"
                    ? "var(--pulse-red)"
                    : assessment.severity === "medium"
                    ? "var(--pulse-orange)"
                    : "var(--pulse-green)"
                }
              />
              {assessment.medications?.length > 0 && (
                <Row label="Medications" value={assessment.medications.join(", ")} />
              )}
              {assessment.relevant_history && (
                <Row label="History" value={assessment.relevant_history} />
              )}
              <div
                className="mt-2 pt-3 text-xs leading-relaxed"
                style={{ borderTop: "1px solid var(--border)", color: "#aaa" }}
              >
                {assessment.summary}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div
              className="flex-1 rounded-xl p-3 text-xs text-center"
              style={{ background: "#001a14", color: "var(--pulse-green)" }}
            >
              ✓ Family notified
            </div>
            <div
              className="flex-1 rounded-xl p-3 text-xs text-center"
              style={{ background: "#0d0d1a", color: "#3b82f6" }}
            >
              ⚡ Inngest timeline logged
            </div>
          </div>

          <button
            onClick={onReset}
            className="text-sm text-center py-3 rounded-xl border transition-all hover:opacity-70"
            style={{ borderColor: "var(--border)", color: "#666" }}
          >
            Start new emergency
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: "#555" }}>{label}</span>
      <span
        className="font-medium text-right"
        style={{ color: valueColor ?? "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}
