"use client";

import { useState, useEffect, useCallback } from "react";
import EvoraChat from "@/components/EvoraChat";
import EvoraDashboard from "@/components/CaregiverDashboard";
import FamilyPortal from "@/components/FamilyPortal";
import UserNav, { type SessionUser } from "@/components/UserNav";
import LoginScreen from "@/components/LoginScreen";
import SponsorFooter from "@/components/SponsorFooter";
import { DEFAULT_MEMORIES } from "@/lib/mock-memories";
import type { Memory } from "@/lib/mock-memories";
import type { Alert, Message } from "@/lib/types";
import { DOMAINS } from "@/lib/domains";

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [memories, setMemories] = useState<Memory[]>(DEFAULT_MEMORIES);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  function onAlert(a: Omit<Alert, "id" | "timestamp">) {
    setAlerts((prev) => [
      { id: Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), ...a },
      ...prev,
    ]);
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fffdf8", color: "#b0a480", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSuccess={loadSession} />;
  }

  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  const theme = DOMAINS[user.domain];

  return (
    <div style={{ background: theme.bg, minHeight: "100dvh", color: "#17110a", paddingBottom: 36, transition: "background 0.35s ease" }}>
      <UserNav user={user} onLogout={handleLogout} alertCount={highAlerts} />

      <main style={{ paddingTop: user.domain === "patient" ? 0 : 72 }}>
        {user.domain === "patient" && (
          <EvoraChat messages={messages} setMessages={setMessages} memories={memories} onAlert={onAlert} />
        )}
        {user.domain === "caretaker" && (
          <EvoraDashboard user={user} messages={messages} setMessages={setMessages} alerts={alerts} memories={memories} setMemories={setMemories} />
        )}
        {user.domain === "family" && (
          <FamilyPortal user={user} messages={messages} alerts={alerts} memories={memories} setMemories={setMemories} />
        )}
      </main>

      <SponsorFooter />
    </div>
  );
}
