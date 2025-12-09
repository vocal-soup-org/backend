// storySessions.ts
import { Puzzle } from "./Schema/Puzzle";
import { getPuzzleFromDB } from "./Service/puzzleService"; // DB-backed getPuzzle

export interface StorySession {
  id: string;
  userId?: string;
  puzzleId: string;  // one puzzle per session
  completedPartIndexes: Number[],
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
    completedPartIndexes: [],
  };

  storySessions.set(id, session);
  return session;
}

export function completePartForSession(
  sessionId: string,
  partIndex: number
): void {
  const session = storySessions.get(sessionId);
  if (!session) {
    throw new Error(`StorySession '${sessionId}' not found`);
  }
  if (!session.completedPartIndexes.includes(partIndex)) {
    session.completedPartIndexes.push(partIndex);
  }

  storySessions.set(sessionId, session);
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

export async function getStorySessionCompletion(
  sessionId: string
): Promise<number> {
  const session = storySessions.get(sessionId);
  if (!session) {
    throw new Error(`StorySession '${sessionId}' not found`);
  }

  const puzzle: Puzzle | null = await getPuzzleFromDB(session.puzzleId);
  if (!puzzle) {
    throw new Error(`Puzzle '${session.puzzleId}' not found`);
  }

  const totalParts = puzzle.parts.length;
  if (totalParts === 0) {
    return 0;
  }

  // Make sure we don't double-count if the same index was added twice
  const uniqueCompleted = new Set(session.completedPartIndexes).size;

  return uniqueCompleted / totalParts; // 0.0 – 1.0
}

export function deleteStorySession(id: string) {
  storySessions.delete(id);
}
