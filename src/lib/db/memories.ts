import { DEFAULT_MEMORIES, type Memory } from "@/lib/mock-memories";
import { DEFAULT_SESSION_ID, getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

let memoryStore: Memory[] = [...DEFAULT_MEMORIES];

function rowToMemory(row: {
  id: string;
  type: string;
  label: string;
  content: string;
}): Memory {
  return {
    id: row.id,
    type: row.type as Memory["type"],
    label: row.label,
    content: row.content,
  };
}

async function seedIfEmpty(sessionId: string): Promise<void> {
  const { count } = await getSupabaseAdmin()
    .from("memories")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (count && count > 0) return;

  await getSupabaseAdmin().from("memories").insert(
    DEFAULT_MEMORIES.map((m) => ({
      session_id: sessionId,
      type: m.type,
      label: m.label,
      content: m.content,
    }))
  );
}

export async function getSessionMemories(sessionId = DEFAULT_SESSION_ID): Promise<Memory[]> {
  if (!isSupabaseConfigured()) return memoryStore;

  try {
    await seedIfEmpty(sessionId);
    const { data, error } = await getSupabaseAdmin()
      .from("memories")
      .select("id, type, label, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[db/memories] get", error.message);
      return memoryStore;
    }

    const mapped = (data ?? []).map(rowToMemory);
    memoryStore = mapped.length ? mapped : memoryStore;
    return memoryStore;
  } catch (err) {
    console.error("[db/memories] get", err);
    return memoryStore;
  }
}

export async function syncSessionMemories(
  next: Memory[],
  sessionId = DEFAULT_SESSION_ID
): Promise<void> {
  memoryStore = next.slice(-100);
  if (!isSupabaseConfigured()) return;

  const db = getSupabaseAdmin();
  await db.from("memories").delete().eq("session_id", sessionId);
  if (!memoryStore.length) return;

  const { error } = await db.from("memories").insert(
    memoryStore.map((m) => ({
      session_id: sessionId,
      type: m.type,
      label: m.label,
      content: m.content,
    }))
  );
  if (error) console.error("[db/memories] sync", error.message);
}

export async function addFamilyNote(
  content: string,
  label = "Message from Sarah",
  sessionId = DEFAULT_SESSION_ID
): Promise<Memory> {
  const trimmed = content.trim();
  const fallback: Memory = {
    id: `family-${Date.now()}`,
    type: "family",
    label,
    content: trimmed,
  };

  if (!isSupabaseConfigured()) {
    memoryStore = [...memoryStore, fallback];
    return fallback;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .insert({
      session_id: sessionId,
      type: "family",
      label,
      content: trimmed,
    })
    .select("id, type, label, content")
    .single();

  if (error) {
    console.error("[db/memories] addFamilyNote", error.message);
    memoryStore = [...memoryStore, fallback];
    return fallback;
  }

  const note = rowToMemory(data);
  memoryStore = [...memoryStore, note];
  return note;
}

export async function getFamilyNotes(sessionId = DEFAULT_SESSION_ID): Promise<Memory[]> {
  const all = await getSessionMemories(sessionId);
  return all.filter((m) => m.type === "family");
}
