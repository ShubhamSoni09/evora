export type Provider = {
  id: string;
  name: string;
  type: "telehealth" | "urgent_care" | "er";
  specialty: string;
  eta: number; // minutes
  available: boolean;
  avatar: string;
  rating: number;
};

export const MOCK_PROVIDERS: Provider[] = [
  {
    id: "dr-chen",
    name: "Dr. Sarah Chen",
    type: "telehealth",
    specialty: "Emergency Medicine",
    eta: 2,
    available: true,
    avatar: "SC",
    rating: 4.9,
  },
  {
    id: "dr-patel",
    name: "Dr. Raj Patel",
    type: "telehealth",
    specialty: "Internal Medicine",
    eta: 4,
    available: true,
    avatar: "RP",
    rating: 4.8,
  },
  {
    id: "sf-urgent",
    name: "SF Urgent Care",
    type: "urgent_care",
    specialty: "Urgent Care",
    eta: 12,
    available: true,
    avatar: "UC",
    rating: 4.5,
  },
  {
    id: "zuckerberg-er",
    name: "Zuckerberg SF General ER",
    type: "er",
    specialty: "Emergency Department",
    eta: 7,
    available: true,
    avatar: "ER",
    rating: 4.7,
  },
];

export function getProvidersForSeverity(severity: string): Provider[] {
  if (severity === "low") return MOCK_PROVIDERS.filter((p) => p.type === "telehealth");
  if (severity === "medium") return MOCK_PROVIDERS.filter((p) => p.type !== "er");
  return MOCK_PROVIDERS; // high → all options, ER first
}
