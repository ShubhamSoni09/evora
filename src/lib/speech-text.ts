/** Normalize text so TTS sounds warm and conversational */
export function softenSpeechText(text: string): string {
  return text
    .replace(/[—–…]/g, ", ")
    .replace(/;\s*/g, ", ")
    .replace(/\.\.\./g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}
