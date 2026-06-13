import { inngest } from "@/lib/inngest";

export async function POST(req: Request) {
  const { emergencyId, providerId, providerName } = await req.json();

  await inngest.send({
    name: "doctor/connected",
    data: { emergencyId, providerId, providerName, timestamp: new Date().toISOString() },
  });

  return Response.json({ status: "connecting", eta: "< 60 seconds" });
}
