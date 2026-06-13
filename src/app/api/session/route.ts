import { inngest } from "@/lib/inngest";

export async function POST(req: Request) {
  const { action, duration } = await req.json();

  if (action === "started") {
    await inngest.send({
      name: "evora/call-started",
      data: { patientId: "demo-patient", timestamp: new Date().toISOString() },
    });
  } else if (action === "ended") {
    await inngest.send({
      name: "evora/call-ended",
      data: {
        patientId: "demo-patient",
        durationSeconds: duration ?? 0,
        timestamp: new Date().toISOString(),
      },
    });
  } else {
    return Response.json({ error: "invalid action" }, { status: 400 });
  }

  return Response.json({ status: "ok" });
}
