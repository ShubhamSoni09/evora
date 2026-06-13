"use client";

import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { DOMAINS, type Domain } from "@/lib/domains";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  domain: Domain;
  subtitle: string;
};

export default function UserNav({
  user,
  onLogout,
  alertCount = 0,
}: {
  user: SessionUser;
  onLogout: () => void;
  alertCount?: number;
}) {
  const theme = DOMAINS[user.domain];

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 20px",
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "10px 10px 10px 18px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ paddingRight: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#17110a", lineHeight: 1.3, whiteSpace: "nowrap" }}>
            {user.displayName}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 3,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: theme.accent,
            }}
          >
            {theme.label}
            {user.domain === "caretaker" && alertCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 100,
                  background: "#dc2626",
                  color: "white",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {alertCount}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            width: 1,
            alignSelf: "stretch",
            margin: "4px 0",
            background: "rgba(0,0,0,0.08)",
          }}
        />

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onLogout}
          style={{
            marginLeft: 10,
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            background: theme.accentSoft,
            color: theme.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <LogOut size={15} strokeWidth={2.25} />
          Sign out
        </motion.button>
      </div>
    </header>
  );
}
