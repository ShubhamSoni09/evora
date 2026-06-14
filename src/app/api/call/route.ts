import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: Request) {
  const { toPhone, doctorName, assessment, appUrl } = await req.json();

  const briefing = [
    `evora alert.`,
    `Doctor ${doctorName}, you have an incoming patient.`,
    assessment.patient_age ? `Patient is a ${assessment.patient_age} year old ${assessment.gender ?? "individual"}.` : "",
    `Chief complaint: ${assessment.symptoms?.join(", ")}.`,
    assessment.onset_minutes ? `Onset ${assessment.onset_minutes} minutes ago.` : "",
    `Risk level: ${assessment.severity}.`,
    assessment.medications?.length ? `Current medications: ${assessment.medications.join(", ")}.` : "",
    `${assessment.summary}`,
    `Press 1 to accept this patient and connect now.`,
  ].filter(Boolean).join(" ");

  try {
    const call = await client.calls.create({
      to: toPhone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml: `<Response>
        <Say voice="alice" rate="95%">${briefing}</Say>
        <Pause length="1"/>
        <Say voice="alice">Connecting you now.</Say>
      </Response>`,
    });

    return Response.json({ success: true, callSid: call.sid, status: call.status });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
