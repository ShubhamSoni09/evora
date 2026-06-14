import { getPhoneSession } from "@/lib/phone-call-session";
import { buildPhoneOpenTwiml, buildTurnActionUrl } from "@/lib/twilio-voice-twiml";

export const runtime = "nodejs";

/** Twilio hits this when an outbound call connects */
export async function POST(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId) {
    return twimlResponse(`<Response><Say>Sorry, this call could not start.</Say></Response>`);
  }

  const session = getPhoneSession(sessionId);
  const turnUrl = buildTurnActionUrl(sessionId, session?.webhookBase);
  if (!session || !turnUrl) {
    return twimlResponse(`<Response><Say>Sorry, this call session expired.</Say></Response>`);
  }

  const xml = buildPhoneOpenTwiml(session.openerParts, turnUrl, session.webhookBase);
  return twimlResponse(xml);
}

function twimlResponse(xml: string) {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}
