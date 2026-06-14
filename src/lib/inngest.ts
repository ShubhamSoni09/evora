import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "evora" });

export type EmergencyStartedEvent = {
  name: "emergency/started";
  data: {
    emergencyId: string;
    assessment: {
      severity: string;
      symptoms: string[];
      patient_age: number | null;
      onset_minutes: number | null;
      relevant_history: string | null;
      medications: string[];
      recommended_care: string;
      summary: string;
    };
    conversation: string;
  };
};

export type DoctorConnectedEvent = {
  name: "doctor/connected";
  data: {
    emergencyId: string;
    providerId: string;
    providerName: string;
    timestamp: string;
  };
};
