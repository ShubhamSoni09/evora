export type Memory = {
  id: string;
  type: "voice" | "music" | "story" | "routine" | "family";
  label: string;
  content: string;
};

export const DEFAULT_MEMORIES: Memory[] = [
  { id: "1", type: "voice", label: "Sarah's voice message", content: "Hi Mom, I'll talk to you tonight. I love you so much." },
  { id: "f1", type: "family", label: "Note from Sarah", content: "Hi Mom, Tom and the kids say hello. We're thinking of you today and we'll call this evening. Love you always." },
  { id: "2", type: "music", label: "Evening music", content: "Moon River — your favourite song from the 1960s." },
  { id: "3", type: "story", label: "Rose garden", content: "You and Harold tended the rose garden every Sunday morning for 30 years." },
  { id: "4", type: "routine", label: "Morning routine", content: "Wake up, chamomile tea, read the newspaper by the window." },
  { id: "5", type: "story", label: "Christmas 2023", content: "Sarah, Tom, and the grandchildren visited. Everyone wore matching sweaters." },
];
