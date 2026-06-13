import { inngest } from "@/lib/inngest";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const { assessment, conversation } = await req.json();

  const emergencyId = randomUUID();

  await inngest.send({
    name: "emergency/started",
    data: { emergencyId, assessment, conversation },
  });

  return Response.json({ emergencyId, status: "dispatched" });
}
