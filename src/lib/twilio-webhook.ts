import twilio from "twilio";

function formDataToParams(form: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = value.toString();
  });
  return params;
}

/** Validate Twilio webhook signature. Skips validation in dev when token is unset. */
export function validateTwilioWebhook(
  req: Request,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return process.env.NODE_ENV !== "production";

  const signature = req.headers.get("X-Twilio-Signature") ?? "";
  return twilio.validateRequest(authToken, signature, req.url, params);
}

export async function readTwilioForm(req: Request): Promise<FormData | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return null;
  }
  return req.formData();
}

export async function assertTwilioWebhook(req: Request): Promise<Response | null> {
  const form = await readTwilioForm(req);
  const params = form ? formDataToParams(form) : {};
  if (!validateTwilioWebhook(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}
