export type Message = { role: "user" | "assistant"; content: string };

export type Assessment = {
  severity: "low" | "medium" | "high";
  symptoms: string[];
  patient_age?: number;
  gender?: string;
  onset_minutes?: number;
  relevant_history?: string;
  medications: string[];
  summary: string;
};

export type Alert = {
  id: string;
  severity: "low" | "medium" | "high";
  reason: string;
  timestamp: string;
};
