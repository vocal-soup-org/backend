// src/storySessions.ts
export type StoryRole = "system" | "user" | "assistant";

export interface StoryMessage {
  role: StoryRole;
  content: string;
}

export interface StorySession {
  id: string;
  // optional: tie to a logged-in user if you use auth
  userId?: string;
  messages: StoryMessage[];
}

const storySessions = new Map<string, StorySession>();

export function createStorySession(
  id: string,
  messages: StoryMessage[],
  userId?: string
): StorySession {
  const session: StorySession = { id, userId, messages };
  storySessions.set(id, session);
  return session;
}

export function getStorySession(id: string): StorySession | undefined {
  return storySessions.get(id);
}

export function updateStorySession(
  id: string,
  updater: (session: StorySession) => void
): StorySession | undefined {
  const session = storySessions.get(id);
  if (!session) return undefined;
  updater(session);
  return session;
}

export function deleteStorySession(id: string) {
  storySessions.delete(id);
}
