import { DEFAULT_SESSION_ID, getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Alert } from "@/lib/types";

const MAX = 100;
let memoryAlerts: Alert[] = [];

export async function getSessionAlerts(sessionId = DEFAULT_SESSION_ID): Promise<Alert[]> {
  if (!isSupabaseConfigured()) return memoryAlerts;

  const { data, error } = await getSupabaseAdmin()
    .from("alerts")
    .select("id, severity, reason, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(MAX);

  if (error) {
    console.error("[db/alerts] get", error.message);
    return memoryAlerts;
  }

  memoryAlerts = (data ?? []).map((row) => ({
    id: row.id,
    severity: row.severity as Alert["severity"],
    reason: row.reason,
    timestamp: row.created_at,
  }));
  return memoryAlerts;
}

export async function addSessionAlert(
  alert: Omit<Alert, "id" | "timestamp">,
  sessionId = DEFAULT_SESSION_ID
): Promise<Alert> {
  const fallback: Alert = {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    ...alert,
  };

  if (!isSupabaseConfigured()) {
    memoryAlerts = [fallback, ...memoryAlerts].slice(0, MAX);
    return fallback;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("alerts")
    .insert({
      session_id: sessionId,
      severity: alert.severity,
      reason: alert.reason,
    })
    .select("id, severity, reason, created_at")
    .single();

  if (error) {
    console.error("[db/alerts] add", error.message);
    memoryAlerts = [fallback, ...memoryAlerts].slice(0, MAX);
    return fallback;
  }

  const saved: Alert = {
    id: data.id,
    severity: data.severity as Alert["severity"],
    reason: data.reason,
    timestamp: data.created_at,
  };
  memoryAlerts = [saved, ...memoryAlerts].slice(0, MAX);
  return saved;
}
