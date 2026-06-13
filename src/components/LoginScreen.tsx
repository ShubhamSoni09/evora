"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, User, Stethoscope, Heart } from "lucide-react";
import GoldenFlower from "@/components/GoldenFlower";
import { DOMAINS, type Domain } from "@/lib/domains";
import { AUTH_USERS } from "@/lib/auth-users";

const ROLE_META: Record<Domain, { icon: typeof User; hint: string }> = {
  patient: { icon: User, hint: "Margaret's companion portal" },
  caretaker: { icon: Stethoscope, hint: "Clinical dashboard & alerts" },
  family: { icon: Heart, hint: "Messages & updates for Mom" },
};

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [role, setRole] = useState<Domain>("patient");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = AUTH_USERS.find((u) => u.domain === role)!;
  const theme = DOMAINS[role];
  const Icon = ROLE_META[role].icon;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 28px 88px",
        background: "linear-gradient(180deg, #fffdf8 0%, #faf6ee 100%)",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ marginBottom: 20, filter: "drop-shadow(0 6px 16px rgba(217,119,6,0.15))" }}
      >
        <GoldenFlower size={80} />
      </motion.div>

      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", color: "#17110a" }}>evora</div>
        <div style={{ fontSize: 14, color: "#9a8a70", marginTop: 6 }}>choose your portal to sign in</div>
      </div>

      {/* Role cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          width: "100%",
          maxWidth: 420,
          marginBottom: 28,
        }}
      >
        {AUTH_USERS.map((u) => {
          const t = DOMAINS[u.domain];
          const active = role === u.domain;
          const RoleIcon = ROLE_META[u.domain].icon;
          return (
            <button
              key={u.domain}
              type="button"
              onClick={() => { setRole(u.domain); setPassword(""); setError(null); }}
              style={{
                padding: "16px 12px",
                borderRadius: 16,
                border: `1.5px solid ${active ? t.accent : "rgba(0,0,0,0.06)"}`,
                background: active ? "white" : "rgba(255,255,255,0.6)",
                boxShadow: active ? `0 6px 20px ${t.accent}18` : "none",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  margin: "0 auto 10px",
                  background: t.accentSoft,
                  color: t.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RoleIcon size={18} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? t.accent : t.muted, textTransform: "capitalize" }}>
                {t.label}
              </div>
              <div style={{ fontSize: 10, color: "#b0a490", marginTop: 4, lineHeight: 1.3 }}>
                {u.displayName.split(" ")[0]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Login card */}
      <motion.form
        key={role}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "32px 28px",
          borderRadius: 24,
          background: "white",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: theme.accentSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.accent,
              flexShrink: 0,
            }}
          >
            <Icon size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#17110a" }}>{user.displayName}</div>
            <div style={{ fontSize: 13, color: theme.muted, marginTop: 3 }}>{ROLE_META[role].hint}</div>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#9a8a70", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Username
        </label>
        <div
          style={{
            padding: "13px 16px",
            borderRadius: 14,
            background: theme.bg,
            border: `1px solid ${theme.accent}20`,
            fontSize: 15,
            color: "#17110a",
            marginBottom: 20,
          }}
        >
          {user.username}
        </div>

        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#9a8a70", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: "13px 16px",
            borderRadius: 14,
            border: `1px solid ${theme.accent}28`,
            fontSize: 15,
            outline: "none",
            marginBottom: error ? 12 : 24,
            boxSizing: "border-box",
            background: "white",
          }}
        />

        {error && (
          <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 16, padding: "10px 14px", borderRadius: 12, background: "rgba(220,38,38,0.06)" }}>
            {error}
          </div>
        )}

        <motion.button
          type="submit"
          disabled={loading || !password}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%",
            padding: "15px 24px",
            borderRadius: 14,
            border: "none",
            background: theme.accent,
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || !password ? "wait" : "pointer",
            opacity: loading || !password ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <LogIn size={17} />
          {loading ? "Signing in…" : "Sign in"}
        </motion.button>

        <div style={{ marginTop: 20, fontSize: 12, color: "#b0a490", textAlign: "center" }}>
          Demo password: <strong style={{ color: theme.accent }}>evora</strong>
        </div>
      </motion.form>
    </div>
  );
}
