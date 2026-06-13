import { PATIENT_TIMEZONE } from "./patient";

export type AlertSeverity = "low" | "medium" | "high";

/** Hours when caregiver should be reachable (sundowning + overnight) */
export function isAlertingWindow(now = new Date()): boolean {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PATIENT_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  return h >= 17 || h <= 5;
}

export function caregiverNotificationPlan(
  severity: AlertSeverity,
  now = new Date()
): { notify: boolean; call: boolean; sms: boolean; reason: string } {
  if (severity === "high") {
    return {
      notify: true,
      call: true,
      sms: true,
      reason: "High severity — immediate caregiver call and text",
    };
  }

  if (severity === "medium") {
    const alerting = isAlertingWindow(now);
    return {
      notify: true,
      call: alerting,
      sms: true,
      reason: alerting
        ? "Medium severity during sundowning/overnight window — call and text caregiver"
        : "Medium severity — text caregiver",
    };
  }

  return {
    notify: false,
    call: false,
    sms: false,
    reason: "Low severity — logged in dashboard only",
  };
}
