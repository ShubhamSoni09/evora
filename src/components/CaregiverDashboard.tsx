"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Bell, MessageSquare, Plus, AlertTriangle, Heart, ArrowRight, Moon, FileText, Loader2, Users } from "lucide-react";
import { detectLoop } from "@/lib/loop-detection";
import { extractTopics, getSentiment, getSundownRisk, getEmotionalColor, getLatestEmotionalSummary, getEmotionalTimeline, barHeight } from "@/lib/topic-map";
import { getNextScheduledCall, formatScheduledTime, PROACTIVE_CALL_SLOTS } from "@/lib/call-schedule";
import { PATIENT_NAME } from "@/lib/patient";
import { isAlertingWindow } from "@/lib/alerts";
import type { Memory } from "@/lib/mock-memories";
import type { Alert, Message } from "@/lib/types";
import GoldenFlower from "@/components/GoldenFlower";
import { DOMAINS } from "@/lib/domains";

const theme = DOMAINS.caretaker;

const SEV_COLOR: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#059669" };
const RISK_COLOR: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#059669" };

function ConfusionRing({ pct, color }: { pct: number; color: string }) {
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5"/>
      <circle cx="35" cy="35" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(pct/100)*circ} ${circ}`} transform="rotate(-90 35 35)"
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)" }}/>
      <text x="35" y="40" textAnchor="middle" fill={color} fontSize="13" fontWeight="600">{pct}%</text>
    </svg>
  );
}

const card: React.CSSProperties = {
  borderRadius: 18, background: "white",
  border: "1px solid rgba(0,0,0,0.07)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
};

function SLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c0b090", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
      {icon}{children}
    </div>
  );
}

import type { SessionUser } from "@/components/UserNav";

export default function EvoraDashboard({
  user,
  messages, setMessages, alerts, memories, setMemories,
}: {
  user: SessionUser;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  alerts: Alert[]; memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
}) {
  const [newMemory, setNewMemory]         = useState("");
  const [memFocused, setMemFocused]       = useState(false);
  const [report, setReport]               = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [calling, setCalling]             = useState(false);
  const [callStatus, setCallStatus]       = useState<string | null>(null);
  const [routing, setRouting]             = useState<{
    patientPhone: string;
    caregiverConfigured: boolean;
    caregiverPhone: string | null;
    caregiverPhoneFull?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/routing")
      .then((r) => r.json())
      .then(setRouting)
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/session/messages");
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const safe = data.messages.filter(
            (m: Message) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          );
          if (safe.length > 0) setMessages(safe);
        }
      } catch {
        /* ignore */
      }
    }
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [setMessages]);

  const nextCall = getNextScheduledCall();

  const loopLevel  = detectLoop(messages);
  const confPct    = { none: 0, low: 22, medium: 58, high: 91 }[loopLevel];
  const confColor  = loopLevel === "high" ? "#dc2626" : loopLevel === "medium" ? "#d97706" : "#059669";
  const highAlerts = alerts.filter(a => a.severity === "high").length;
  const userMsgs   = messages.filter(m => m.role === "user").length;
  const topics     = extractTopics(messages, 6);
  const sentiment  = getSentiment(messages);
  const sundown    = getSundownRisk();
  const avgSent    = sentiment.length ? sentiment.reduce((a, b) => a + b, 0) / sentiment.length : 0;
  const sentColor  = getEmotionalColor(avgSent);
  const toneSummary = getLatestEmotionalSummary(messages);
  const toneTimeline = getEmotionalTimeline(messages, 12);
  const hasToneData = toneTimeline.some((p) => p !== null);

  const familyMems  = memories.filter(m => m.type === "family");
  const regularMems = memories.filter(m => m.type !== "family");

  function addMemory() {
    if (!newMemory.trim()) return;
    setMemories(prev => [...prev, { id: Date.now().toString(), type: "story", label: newMemory, content: newMemory }]);
    setNewMemory("");
  }

  async function callCaregiverCheckIn() {
    setCalling(true);
    setCallStatus(null);
    try {
      const res = await fetch("/api/call-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate: true, target: "caregiver", messages, alerts }),
      });
      let data: { error?: string; status?: string; to?: string } = {};
      try {
        data = await res.json();
      } catch {
        setCallStatus(res.ok ? "Call placed" : `Call failed (${res.status})`);
        return;
      }
      if (!res.ok) {
        setCallStatus(data.error ?? `Call failed (${res.status})`);
        return;
      }
      setCallStatus(`Ringing ${data.to ?? routing?.caregiverPhone ?? "caretaker"}…`);
    } catch {
      setCallStatus("Network error — is the dev server running?");
    } finally {
      setCalling(false);
    }
  }

  async function generateReport() {
    if (!messages.length) return;
    setLoadingReport(true); setReport(null);
    try {
      const res = await fetch("/api/cognition-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      setReport(data.report ?? null);
    } finally { setLoadingReport(false); }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 24px 64px", minHeight: "100vh", background: theme.bg }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16,1,0.3,1] }}
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(59,111,168,0.15)" }}>
          <GoldenFlower size={22}/>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.025em", color: "#1a2a3a" }}>{user.displayName}</div>
          <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{PATIENT_NAME} · clinical oversight</div>
        </div>
        <motion.button whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.02 }} onClick={callCaregiverCheckIn} disabled={calling}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 100, background: theme.accent, color: "white", fontSize: 13, fontWeight: 500, border: "none", cursor: calling ? "wait" : "pointer", boxShadow: "0 3px 10px rgba(59,111,168,0.28)", opacity: calling ? 0.7 : 1 }}>
          {calling ? "calling…" : <>check-in call <ArrowRight size={13}/></>}
        </motion.button>
      </motion.div>
      {callStatus && (
        <div style={{
          fontSize: 12,
          color: callStatus.toLowerCase().includes("ringing") ? "#059669" : "#b45309",
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 10,
          background: callStatus.toLowerCase().includes("ringing") ? "rgba(5,150,105,0.08)" : "rgba(217,119,6,0.08)",
          border: `1px solid ${callStatus.toLowerCase().includes("ringing") ? "rgba(5,150,105,0.15)" : "rgba(217,119,6,0.2)"}`,
          lineHeight: 1.5,
        }}>
          {callStatus}
        </div>
      )}

      {/* ── Notification routing ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SLabel icon={<Bell size={12}/>}>alert routing</SLabel>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...card, padding: "16px 18px", fontSize: 12, lineHeight: 1.6, color: "#5a4a30" }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Patient check-ins</strong> → {routing?.patientPhone ?? "…"}
            <div style={{ color: "#b0a480", marginTop: 2 }}>Daily at 10am, 5pm, 7pm ET via Twilio</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Caretaker check-in call</strong> → {routing?.caregiverPhone ?? "…"}
            <div style={{ color: "#b0a480", marginTop: 2 }}>
              Dashboard button rings you at {routing?.caregiverPhoneFull ?? "+1 716 259 6124"}
            </div>
          </div>
          <div>
            <strong>Caregiver alerts</strong> →{" "}
            {routing?.caregiverConfigured ? (
              routing.caregiverPhone
            ) : (
              <span style={{ color: theme.muted }}>not configured</span>
            )}
            {!routing?.caregiverConfigured && (
              <div style={{ color: "#9a7a40", marginTop: 4, fontSize: 11 }}>
                Add caregiver number in server settings to enable alert calls & texts
              </div>
            )}
            <div style={{ color: "#b0a480", marginTop: 2 }}>
              High: call + text · Medium: text{isAlertingWindow() ? " + call (sundowning window active)" : ""} · Low: dashboard only
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── 1. SUNDOWNING COPILOT ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SLabel icon={<Moon size={12}/>}>sundowning copilot</SLabel>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          style={{ ...card, padding: "18px 20px", borderLeft: `3px solid ${RISK_COLOR[sundown.risk]}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#17110a" }}>{sundown.note}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: `${RISK_COLOR[sundown.risk]}10`, color: RISK_COLOR[sundown.risk], border: `1px solid ${RISK_COLOR[sundown.risk]}22`, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                  {sundown.risk} risk
                </span>
              </div>
              <div style={{ background: "rgba(0,0,0,0.06)", borderRadius: 4, height: 6, marginBottom: 8 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${sundown.pct}%` }}
                  transition={{ duration: 0.8, ease: [0.16,1,0.3,1], delay: 0.2 }}
                  style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${RISK_COLOR[sundown.risk]}80, ${RISK_COLOR[sundown.risk]})` }}/>
              </div>
              <div style={{ fontSize: 12, color: "#b0a480", lineHeight: 1.5, marginBottom: 10 }}>{sundown.action}</div>
              {nextCall && (
                <div style={{ fontSize: 11, color: "#3b82f6", padding: "8px 10px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
                  ⚡ Next scheduled call: <strong>{nextCall.slot.label}</strong> · {formatScheduledTime(nextCall.at)} ET
                  <div style={{ marginTop: 4, color: "#b0a480" }}>
                    Daily at {PROACTIVE_CALL_SLOTS.map(s => `${s.hour > 12 ? s.hour - 12 : s.hour}${s.hour >= 12 ? "pm" : "am"}`).join(", ")} to {routing?.patientPhone ?? "patient"}
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: RISK_COLOR[sundown.risk], flexShrink: 0, letterSpacing: "-0.02em" }}>{sundown.pct}%</div>
          </div>
        </motion.div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Brain size={13} style={{ color: confColor }}/>, label: "confusion", content: <ConfusionRing pct={confPct} color={confColor}/>, sub: loopLevel === "none" ? "stable" : `${loopLevel} loop`, subColor: confColor },
          { icon: <MessageSquare size={13} style={{ color: "#b8840f" }}/>, label: "exchanges", content: <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", color: "#17110a", lineHeight: 1 }}>{userMsgs}</div>, sub: "this session", subColor: "#b0a480" },
          { icon: <Bell size={13} style={{ color: highAlerts > 0 ? "#dc2626" : "#b8840f" }}/>, label: "alerts", content: <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: highAlerts > 0 ? "#dc2626" : "#17110a" }}>{alerts.length}</div>, sub: highAlerts > 0 ? `${highAlerts} critical` : "no critical", subColor: highAlerts > 0 ? "#dc2626" : "#b0a480" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06 }}
            style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "20px 12px" }}>
            <div style={{ fontSize: 10, color: "#b0a480", letterSpacing: "0.07em", textTransform: "uppercase" as const, display: "flex", alignItems: "center", gap: 4 }}>{s.icon}{s.label}</div>
            {s.content}
            <div style={{ fontSize: 11, color: s.subColor }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── 6. CONVERSATION MEMORY MAP ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SLabel icon={<MessageSquare size={12}/>}>conversation memory map</SLabel>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ ...card, padding: "18px 20px" }}>
          {messages.length === 0 ? (
            <div style={{ fontSize: 13, color: "#b0a480", textAlign: "center", padding: "8px 0" }}>
              topics will appear once Margaret starts talking
            </div>
          ) : (
            <>
              {topics.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#b0a480", marginBottom: 10, letterSpacing: "0.04em" }}>TOP TOPICS TODAY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {topics.map((t, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 72, fontSize: 12, color: "#17110a", fontWeight: 500, flexShrink: 0 }}>{t.word}</div>
                        <div style={{ flex: 1, height: 6, background: "rgba(0,0,0,0.05)", borderRadius: 4, overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${t.pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16,1,0.3,1] }}
                            style={{ height: "100%", background: "linear-gradient(90deg, #d4a84388, #d4a843)", borderRadius: 4 }}/>
                        </div>
                        <div style={{ fontSize: 11, color: "#b0a480", width: 22, textAlign: "right" as const, flexShrink: 0 }}>{t.count}×</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, color: "#b0a480", marginBottom: 8, letterSpacing: "0.04em" }}>EMOTIONAL TONE</div>
                {!hasToneData ? (
                  <div style={{ fontSize: 12, color: "#b0a480", textAlign: "center", padding: "10px 0" }}>
                    tone chart fills in as Margaret speaks
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 56, padding: "0 2px" }}>
                      {toneTimeline.map((point, i) => {
                        if (!point) {
                          return (
                            <div
                              key={i}
                              style={{
                                width: 16,
                                height: 10,
                                borderRadius: 4,
                                background: "rgba(0,0,0,0.05)",
                                flexShrink: 0,
                              }}
                            />
                          );
                        }
                        const h = barHeight(point.score);
                        const isLatest = i === toneTimeline.length - 1 || !toneTimeline.slice(i + 1).some(Boolean);
                        return (
                          <motion.div
                            key={i}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: h, opacity: isLatest ? 1 : 0.65 }}
                            transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            title={`${point.label}: "${point.snippet}"`}
                            style={{
                              width: 16,
                              borderRadius: 4,
                              background: point.color,
                              flexShrink: 0,
                              boxShadow: isLatest ? `0 0 0 2px ${point.color}35` : "none",
                            }}
                          />
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "#b0a480" }}>earliest</span>
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: toneSummary.color, display: "block" }}>
                          {toneSummary.label}
                        </span>
                        <span style={{ fontSize: 10, color: "#b0a480" }}>
                          session avg {avgSent >= 0 ? "+" : ""}{avgSent.toFixed(2)}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: "#b0a480" }}>latest</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 8 }}>
                      {[
                        { label: "calm", color: "#059669" },
                        { label: "neutral", color: "#c9a86c" },
                        { label: "distress", color: "#dc2626" },
                      ].map((item) => (
                        <span key={item.label} style={{ fontSize: 10, color: "#b0a480", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, opacity: 0.75 }} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Alerts ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 24 }}>
            <SLabel icon={<AlertTriangle size={12}/>}>recent alerts</SLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.slice(0, 5).map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderLeft: `3px solid ${SEV_COLOR[a.severity]}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#17110a", lineHeight: 1.4 }}>{a.reason}</div>
                    <div style={{ fontSize: 11, color: "#b0a480", marginTop: 2 }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div style={{ fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase" as const, padding: "3px 9px", borderRadius: 100, flexShrink: 0, background: `${SEV_COLOR[a.severity]}10`, color: SEV_COLOR[a.severity], border: `1px solid ${SEV_COLOR[a.severity]}22` }}>
                    {a.severity}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Family messages (managed in family portal) */}
      {familyMems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SLabel icon={<Users size={12}/>}>family messages queued</SLabel>
          <div style={{ fontSize: 12, color: theme.muted, padding: "12px 14px", ...card }}>
            {familyMems.length} message{familyMems.length > 1 ? "s" : ""} ready for evora to deliver — managed in the <strong>family</strong> portal.
          </div>
        </div>
      )}

      {/* ── Memory Anchors (clinical) ───────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SLabel icon={<Heart size={12}/>}>memory anchors</SLabel>
        {regularMems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {regularMems.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ ...card, display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(196,154,48,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Heart size={13} style={{ color: "#c49a30" }}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#17110a" }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "#b0a480", marginTop: 2, lineHeight: 1.5 }}>{m.content}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          animate={memFocused ? { boxShadow: "0 0 0 3px rgba(196,154,48,0.13)" } : { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          style={{ display: "flex", gap: 8, alignItems: "center", background: "white", borderRadius: 14, border: `1.5px solid ${memFocused ? "rgba(196,154,48,0.45)" : "rgba(0,0,0,0.08)"}`, padding: "8px 8px 8px 14px", transition: "border-color 0.2s" }}
        >
          <input
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#17110a", lineHeight: 1.5 }}
            placeholder="add a clinical memory anchor..."
            value={newMemory} onChange={e => setNewMemory(e.target.value)}
            onFocus={() => setMemFocused(true)} onBlur={() => setMemFocused(false)}
            onKeyDown={e => e.key === "Enter" && addMemory()}
          />
          <motion.button whileTap={newMemory.trim() ? { scale: 0.9 } : {}} onClick={addMemory} disabled={!newMemory.trim()}
            style={{ width: 34, height: 34, borderRadius: 10, border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: newMemory.trim() ? "pointer" : "not-allowed", background: newMemory.trim() ? "linear-gradient(135deg, #b8840f, #d4a843)" : "rgba(0,0,0,0.04)", color: newMemory.trim() ? "white" : "#c0b090", boxShadow: newMemory.trim() ? "0 2px 8px rgba(196,154,48,0.28)" : "none", transition: "all 0.2s" }}>
            <Plus size={16}/>
          </motion.button>
        </motion.div>
      </div>

      {/* ── 5. DOCTOR BEFORE EMERGENCY ──────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SLabel icon={<FileText size={12}/>}>doctor before emergency</SLabel>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "repetitions", value: Math.max(0, userMsgs - new Set(messages.filter(m => m.role === "user").map(m => m.content.toLowerCase().slice(0,24))).size), color: "#d97706" },
              { label: "avg sentiment", value: avgSent.toFixed(1), color: sentColor },
              { label: "confusion", value: `${confPct}%`, color: confColor },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "10px 8px", borderRadius: 12, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#b0a480", marginTop: 3, letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {report && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#3d2e10", lineHeight: 1.7, padding: "12px 14px", background: "rgba(196,154,48,0.05)", borderRadius: 12, border: "1px solid rgba(196,154,48,0.15)" }}>
                  {report}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button whileTap={{ scale: 0.96 }} onClick={generateReport} disabled={loadingReport || messages.length === 0}
            style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: messages.length === 0 ? "not-allowed" : "pointer", background: messages.length === 0 ? "rgba(0,0,0,0.04)" : "linear-gradient(135deg, #b8840f, #c49a30)", color: messages.length === 0 ? "#c0b090" : "white", fontSize: 13, fontWeight: 500, boxShadow: messages.length === 0 ? "none" : "0 3px 10px rgba(196,154,48,0.3)", transition: "all 0.2s" }}>
            {loadingReport ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> generating...</> : <><FileText size={14}/> generate clinical report</>}
          </motion.button>
          {messages.length === 0 && <div style={{ fontSize: 11, color: "#b0a480", textAlign: "center", marginTop: 8 }}>start a call first</div>}
        </motion.div>
      </div>

      {/* ── Live Transcript ──────────────────────────────────────────────────── */}
      {messages.length > 0 && (
        <div>
          <SLabel icon={<MessageSquare size={12}/>}>live conversation</SLabel>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 280, overflowY: "auto" }}>
              {messages.slice(-14).map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "10px 16px", borderBottom: i < 13 ? "1px solid rgba(0,0,0,0.04)" : "none", background: m.role === "assistant" ? "rgba(196,154,48,0.025)" : "transparent" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" as const, flexShrink: 0, minWidth: 52, color: m.role === "user" ? "#b8840f" : "#c49a30" }}>
                    {m.role === "user" ? "margaret" : "evora"}
                  </span>
                  <span style={{ fontSize: 12, color: "#17110a", lineHeight: 1.6 }}>{m.content}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
