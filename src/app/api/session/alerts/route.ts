import { requireRoles } from "@/lib/api-auth";
import { getSessionAlerts, addSessionAlert } from "@/lib/db/alerts";
import type { Alert } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ alerts: await getSessionAlerts() });
}

export async function POST(req: Request) {
  const auth = await requireRoles("patient", "caretaker");
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const { severity, reason } = body as { severity?: Alert["severity"]; reason?: string };

  if (!severity || !reason?.trim()) {
    return Response.json({ error: "severity and reason required" }, { status: 400 });
  }

  const alert = await addSessionAlert({ severity, reason: reason.trim() });
  return Response.json({ ok: true, alert });
}
