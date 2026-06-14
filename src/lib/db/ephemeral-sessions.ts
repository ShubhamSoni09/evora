import type { Message } from "@/lib/types";
import type { PhoneCallRole, PhoneCallSession } from "@/lib/phone-call-session";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

type PhoneSessionRow = {
  id: string;
  role: string;
  messages: Message[];
  opener_parts: string[];
  turn_count: number;
  reprompts: number;
  max_turns: number;
  webhook_base: string | null;
  expires_at: string;
};

function rowToSession(row: PhoneSessionRow): PhoneCallSession {
  return {
    id: row.id,
    role: row.role as PhoneCallRole,
    messages: row.messages ?? [],
    openerParts: row.opener_parts ?? [],
    turnCount: row.turn_count,
    reprompts: row.reprompts,
    maxTurns: row.max_turns,
    webhookBase: row.webhook_base,
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

function sessionToRow(session: PhoneCallSession) {
  return {
    id: session.id,
    role: session.role,
    messages: session.messages,
    opener_parts: session.openerParts,
    turn_count: session.turnCount,
    reprompts: session.reprompts,
    max_turns: session.maxTurns,
    webhook_base: session.webhookBase,
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}

export async function dbSavePhoneSession(session: PhoneCallSession): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseAdmin()
    .from("phone_sessions")
    .upsert(sessionToRow(session), { onConflict: "id" });
  if (error) console.error("[db/phone-sessions] save", error.message);
}

export async function dbLoadPhoneSession(id: string): Promise<PhoneCallSession | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("phone_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[db/phone-sessions] load", error.message);
    return null;
  }
  if (!data) return null;

  const session = rowToSession(data as PhoneSessionRow);
  if (session.expiresAt <= Date.now()) {
    await dbDeletePhoneSession(id);
    return null;
  }
  return session;
}

export async function dbDeletePhoneSession(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabaseAdmin().from("phone_sessions").delete().eq("id", id);
}

export async function dbSaveTtsSession(id: string, parts: string[], expiresAt: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseAdmin().from("tts_sessions").upsert(
    {
      id,
      parts,
      expires_at: new Date(expiresAt).toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) console.error("[db/tts-sessions] save", error.message);
}

export async function dbLoadTtsPart(
  sessionId: string,
  index: number
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("tts_sessions")
    .select("parts, expires_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    await getSupabaseAdmin().from("tts_sessions").delete().eq("id", sessionId);
    return null;
  }
  const parts = data.parts as string[];
  return parts[index] ?? null;
}
