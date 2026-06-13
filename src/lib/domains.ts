/** Visual identity per portal domain */
export type Domain = "patient" | "caretaker" | "family";

export const DOMAINS: Record<
  Domain,
  { label: string; tagline: string; bg: string; accent: string; accentSoft: string; muted: string; card: string }
> = {
  patient: {
    label: "patient",
    tagline: "talk with evora",
    bg: "#fffdf8",
    accent: "#c49a30",
    accentSoft: "rgba(196,154,48,0.12)",
    muted: "#b0a480",
    card: "#fffef9",
  },
  caretaker: {
    label: "caretaker",
    tagline: "clinical oversight",
    bg: "#f4f7fb",
    accent: "#3b6fa8",
    accentSoft: "rgba(59,111,168,0.1)",
    muted: "#7a8fa8",
    card: "#ffffff",
  },
  family: {
    label: "family",
    tagline: "stay close to mom",
    bg: "#fdf6f4",
    accent: "#c45c5c",
    accentSoft: "rgba(196,92,92,0.1)",
    muted: "#b09090",
    card: "#fffbfa",
  },
};
