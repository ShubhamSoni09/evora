import type { Message } from "./types";

const MAX = 200;
let messages: Message[] = [];

export function getSessionMessages(): Message[] {
  return messages;
}

export function syncSessionMessages(next: Message[]): void {
  messages = next.slice(-MAX);
}
