"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, Sparkles } from "lucide-react";
import GoldenFlower from "@/components/GoldenFlower";
import { DOMAINS } from "@/lib/domains";
import { PATIENT_NAME } from "@/lib/patient";
import type { Memory } from "@/lib/mock-memories";
import type { Alert, Message } from "@/lib/types";

const theme = DOMAINS.family;

import type { SessionUser } from "@/components/UserNav";

export default function FamilyPortal({
  user,
  messages,
  alerts,
  memories,
  setMemories,
}: {
  user: SessionUser;
  messages: Message[];
  alerts: Alert[];
  memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
}) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);

  const familyMessages = memories.filter((m) => m.type === "family");
  const userMsgs = messages.filter((m) => m.role === "user").length;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  function sendMessage() {
    if (!draft.trim()) return;
    setMemories((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: "family",
        label: "Message from family",
        content: draft.trim(),
      },
    ]);
    setDraft("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  const card: React.CSSProperties = {
    borderRadius: 18,
    background: theme.card,
    border: "1px solid rgba(196,92,92,0.1)",
    boxShadow: "0 2px 12px rgba(196,92,92,0.06)",
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 24px 72px", minHeight: "100vh", background: theme.bg }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(196,92,92,0.12)",
          }}
        >
          <GoldenFlower size={28} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em", color: "#3d2020" }}>{user.displayName}</div>
          <div style={{ fontSize: 12, color: theme.muted }}>family · updates for {PATIENT_NAME.split(" ")[0]}</div>
        </div>
      </motion.div>

      {/* Glance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { label: "mom spoke today", value: userMsgs, sub: userMsgs ? "exchanges" : "not yet" },
          { label: "alerts", value: alerts.length, sub: alerts.length ? "check in" : "all calm" },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.accent, letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: theme.muted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {lastUser && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>last thing she said</div>
          <div style={{ fontSize: 14, color: "#3d2020", lineHeight: 1.55, fontStyle: "italic" }}>&ldquo;{lastUser.content}&rdquo;</div>
        </div>
      )}

      {/* Send love */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
          <Heart size={12} /> send a message
        </div>
        <p style={{ fontSize: 13, color: theme.muted, lineHeight: 1.55, marginBottom: 12 }}>
          Write something warm. Evora will share it with {PATIENT_NAME.split(" ")[0]} when she needs comfort.
        </p>
        <div style={{ ...card, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Hi Mom, thinking of you today. Sarah loves you."
            rows={3}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.55,
              color: "#3d2020",
              background: "transparent",
              fontFamily: "inherit",
            }}
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={sendMessage}
            disabled={!draft.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: draft.trim() ? "pointer" : "not-allowed",
              background: draft.trim() ? theme.accent : "rgba(0,0,0,0.05)",
              color: "white",
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </motion.button>
        </div>
        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginTop: 10, fontSize: 12, color: "#059669", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Sparkles size={13} /> Message saved — evora can deliver it anytime
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delivered messages */}
      {familyMessages.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.muted, marginBottom: 12 }}>
            your messages
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {familyMessages.map((m) => (
              <div key={m.id} style={{ ...card, padding: "14px 16px", borderLeft: `3px solid ${theme.accent}` }}>
                <div style={{ fontSize: 14, color: "#3d2020", lineHeight: 1.55 }}>{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation peek */}
      {messages.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <MessageCircle size={12} /> conversation peek
          </div>
          <div style={{ ...card, overflow: "hidden" }}>
            {messages.slice(-6).map((m, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < 5 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  background: m.role === "assistant" ? theme.accentSoft : "transparent",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: theme.accent, marginBottom: 3 }}>
                  {m.role === "user" ? PATIENT_NAME.split(" ")[0] : "evora"}
                </div>
                <div style={{ fontSize: 13, color: "#3d2020", lineHeight: 1.5 }}>{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
