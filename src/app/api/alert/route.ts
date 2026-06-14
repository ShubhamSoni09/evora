import { requireRoles } from "@/lib/api-auth";
import { inngest } from "@/lib/inngest";
import { addSessionAlert } from "@/lib/db/alerts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireRoles("patient", "caretaker");
  if (auth instanceof Response) return auth;

  const { severity, reason, conversation } = await req.json();

  await addSessionAlert({ severity, reason });

  await inngest.send({
    name: "evora/escalation",
    data: {
      severity,
      reason,
      conversation: conversation ?? "",
      patientId: "demo-patient",
      timestamp: new Date().toISOString(),
    },
  });

  return Response.json({ status: "queued" });
}
