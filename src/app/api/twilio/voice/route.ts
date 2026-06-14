import { getPhoneSession } from "@/lib/phone-call-session";
import { validateTwilioWebhook } from "@/lib/twilio-webhook";
import { buildPhoneOpenTwiml, buildTurnActionUrl } from "@/lib/twilio-voice-twiml";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Twilio hits this when an outbound call connects */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  form?.forEach((value, key) => {
    params[key] = value.toString();
  });
  if (!validateTwilioWebhook(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId) {
    return twimlResponse(`<Response><Say>Sorry, this call could not start.</Say></Response>`);
  }

  const session = await getPhoneSession(sessionId);
  const turnUrl = buildTurnActionUrl(sessionId, session?.webhookBase);
  if (!session || !turnUrl) {
    return twimlResponse(`<Response><Say>Sorry, this call session expired.</Say></Response>`);
  }

  const xml = await buildPhoneOpenTwiml(session.openerParts, turnUrl, session.webhookBase);
  return twimlResponse(xml);
}

function twimlResponse(xml: string) {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}
