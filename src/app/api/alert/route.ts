import { inngest } from "@/lib/inngest";

export async function POST(req: Request) {
  const { severity, reason, conversation } = await req.json();

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
