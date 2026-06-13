import OpenAI from "openai";
import { lookupPatient, FHIRPatient } from "./fhir";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Tools the LLM can call during triage
const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_patient_ehr",
      description:
        "Look up a patient's medical record from EHR. Returns medications, conditions, care team, and demographics. Call this as soon as you have the patient's name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Patient's full name or 'self' if the caller is the patient" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_assessment",
      description:
        "Generate a structured emergency assessment once you have enough information (symptoms, patient context, onset). Call this when ready to route care.",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high"] },
          symptoms: { type: "array", items: { type: "string" } },
          patient_age: { type: "number" },
          onset_minutes: { type: "number" },
          relevant_history: { type: "string" },
          medications: { type: "array", items: { type: "string" } },
          recommended_care: { type: "string", enum: ["telehealth", "urgent_care", "er", "911"] },
          summary: { type: "string", description: "2-3 sentence clinical summary for the receiving doctor" },
        },
        required: ["severity", "symptoms", "recommended_care", "summary"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are PulseRoute, an emergency medical intake AI. You help people in medical emergencies get to the right care fast.

Your job:
1. Ask what's happening (one focused question at a time)
2. As soon as you hear a name, call lookup_patient_ehr to pull their medical record — don't ask for medications or history if you can get it from EHR
3. Once you have: symptoms + patient context (from EHR or conversation) + onset → call generate_assessment

Rules:
- Ask ONE question at a time. Be calm and fast.
- If EHR has medications/history, confirm them instead of asking from scratch ("I see you're on Amlodipine — is that still current?")
- After 3-5 exchanges, you should have enough to assess. Don't over-question.
- Be human, not robotic. This person may be panicking.`;

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: any }
  | { type: "tool_result"; name: string; result: any }
  | { type: "assessment"; data: any };

export async function* runTriageAgent(
  messages: { role: string; content: string }[]
): AsyncGenerator<AgentEvent> {
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  let patientRecord: FHIRPatient | null = null;

  // Agentic loop — keep going until we get an assessment or plain response
  for (let turn = 0; turn < 5; turn++) {
    const response = await xai.chat.completions.create({
      model: "grok-3",
      messages: history,
      tools: TOOLS,
      tool_choice: "auto",
      stream: false,
    });

    const msg = response.choices[0].message;
    history.push(msg);

    // Stream any text content
    if (msg.content) {
      yield { type: "text", content: msg.content };
    }

    // No tool calls → done
    if (!msg.tool_calls?.length) break;

    // Execute tool calls
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function" || !("function" in tc)) continue;
      const args = JSON.parse(tc.function.arguments);
      yield { type: "tool_call", name: tc.function.name, args };

      let result: any;

      if (tc.function.name === "lookup_patient_ehr") {
        patientRecord = await lookupPatient(args.name);
        result = patientRecord
          ? {
              found: true,
              name: patientRecord.name,
              age: patientRecord.age,
              medications: patientRecord.medications,
              conditions: patientRecord.conditions,
              careTeam: patientRecord.careTeam.map((c) => ({ name: c.name, role: c.role })),
            }
          : { found: false };
        yield { type: "tool_result", name: "lookup_patient_ehr", result };
      }

      if (tc.function.name === "generate_assessment") {
        result = { ...args, careTeam: patientRecord?.careTeam ?? [] };
        yield { type: "assessment", data: result };
        return; // Done
      }

      history.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }
}
