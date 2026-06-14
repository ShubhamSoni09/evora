import { DEFAULT_SESSION_ID, getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

const MAX = 200;
let memoryMessages: Message[] = [];

export async function getSessionMessages(sessionId = DEFAULT_SESSION_ID): Promise<Message[]> {
  if (!isSupabaseConfigured()) return memoryMessages;

  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .select("role, content, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true })
    .limit(MAX);

  if (error) {
    console.error("[db/messages] get", error.message);
    return memoryMessages;
  }

  return (data ?? []).map((row) => ({
    role: row.role as Message["role"],
    content: row.content,
  }));
}

export async function syncSessionMessages(
  next: Message[],
  sessionId = DEFAULT_SESSION_ID
): Promise<void> {
  const trimmed = next.slice(-MAX);
  memoryMessages = trimmed;

  if (!isSupabaseConfigured()) return;

  const db = getSupabaseAdmin();
  const { error: delErr } = await db.from("messages").delete().eq("session_id", sessionId);
  if (delErr) {
    console.error("[db/messages] delete", delErr.message);
    return;
  }

  if (!trimmed.length) return;

  const { error: insErr } = await db.from("messages").insert(
    trimmed.map((m, i) => ({
      session_id: sessionId,
      role: m.role,
      content: m.content,
      sort_order: i,
    }))
  );

  if (insErr) console.error("[db/messages] insert", insErr.message);
}
