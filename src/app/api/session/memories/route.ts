import { requireRoles } from "@/lib/api-auth";
import { getSessionMemories, syncSessionMemories, addFamilyNote } from "@/lib/memory-store";
import type { Memory } from "@/lib/mock-memories";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ memories: await getSessionMemories() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { memories, familyNote, familyLabel } = body as {
    memories?: Memory[];
    familyNote?: string;
    familyLabel?: string;
  };

  if (typeof familyNote === "string" && familyNote.trim()) {
    const auth = await requireRoles("family");
    if (auth instanceof Response) return auth;
    const note = await addFamilyNote(familyNote, familyLabel);
    return Response.json({ ok: true, memories: await getSessionMemories(), added: note });
  }

  if (Array.isArray(memories)) {
    const auth = await requireRoles("caretaker");
    if (auth instanceof Response) return auth;
    await syncSessionMemories(memories);
    return Response.json({ ok: true, memories: await getSessionMemories() });
  }

  return Response.json({ error: "memories or familyNote required" }, { status: 400 });
}
