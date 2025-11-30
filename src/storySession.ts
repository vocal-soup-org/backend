// storySessions.ts
import { Puzzle } from "./Schema/Puzzle";
import { getPuzzleFromDB } from "./Service/puzzleService"; // DB-backed getPuzzle

export interface StorySession {
  id: string;
  userId?: string;
  puzzleId: string;  // one puzzle per session
  // you can add more fields later (e.g. story progress, timestamps)
}

const storySessions = new Map<string, StorySession>();

export async function createStorySession(params: {
  id: string;
  puzzleId: string;
  userId?: string;
}): Promise<StorySession> {
  const { id, puzzleId, userId } = params;

  // Optional: ensure the puzzle actually exists
  const puzzle: Puzzle | null = await getPuzzleFromDB(puzzleId);
  if (!puzzle) {
    throw new Error(`StorySession: puzzle '${puzzleId}' not found`);
  }

  const session: StorySession = {
    id,
    userId,
    puzzleId,
  };

  storySessions.set(id, session);
  return session;
}

export function getStorySession(id: string): StorySession | undefined {
  return storySessions.get(id);
}

export function updateStorySession(
  id: string,
  updater: (session: StorySession) => StorySession | void
): StorySession | undefined {
  const session = storySessions.get(id);
  if (!session) return undefined;

  const result = updater(session) || session;
  storySessions.set(id, result);
  return result;
}

export function deleteStorySession(id: string) {
  storySessions.delete(id);
}
