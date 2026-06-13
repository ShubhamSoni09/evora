import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { onEvoraCall, onEvoraEscalation, onManualPatientCall, scheduledProactiveCall } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scheduledProactiveCall, onManualPatientCall, onEvoraCall, onEvoraEscalation],
});
