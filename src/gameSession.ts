// gameSession.ts
// In-memory session storage for puzzle game sessions

import { Puzzle } from "./Schema/Puzzle";
import { getPuzzleFromDB } from "./Service/puzzleService";

export interface GameSession {
  id: string;
  gameId: string;
  puzzleId: string;
  userId?: string;
  language: string;
  attemptNumber: number;
  questionBudget: number;
  questionsUsed: number;
  startedAt: Date;
  timeLimitSeconds: number;
  completedPartIndexes: number[];
  createdAt: Date;
}

const gameSessions = new Map<string, GameSession>();

export async function createGameSession(params: {
  id: string;
  gameId: string;
  puzzleId: string;
  userId?: string;
  language?: string;
  attemptNumber: number;
  questionBudget: number;
  timeLimitSeconds: number;
  completedPartIndexes?: number[];
}): Promise<GameSession> {
  const {
    id,
    gameId,
    puzzleId,
    userId,
    language = 'en',
    attemptNumber,
    questionBudget,
    timeLimitSeconds,
    completedPartIndexes = [],
  } = params;

  // Ensure the puzzle actually exists
  const puzzle: Puzzle | null = await getPuzzleFromDB(puzzleId);
  if (!puzzle) {
    throw new Error(`GameSession: puzzle '${puzzleId}' not found`);
  }

  const session: GameSession = {
    id,
    gameId,
    userId,
    puzzleId,
    language,
    attemptNumber,
    questionBudget,
    questionsUsed: 0,
    startedAt: new Date(),
    timeLimitSeconds,
    completedPartIndexes,
    createdAt: new Date(),
  };

  gameSessions.set(id, session);
  return session;
}

export function incrementQuestionCount(id: string): GameSession {
  const session = gameSessions.get(id);
  if (!session) {
    throw new Error(`GameSession '${id}' not found`);
  }

  session.questionsUsed += 1;
  gameSessions.set(id, session);
  return session;
}

export function getQuestionsRemaining(session: GameSession): number {
  return Math.max(0, session.questionBudget - session.questionsUsed);
}

export function getElapsedSeconds(session: GameSession): number {
  return Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
}

export function isSessionTimedOut(session: GameSession): boolean {
  return getElapsedSeconds(session) > session.timeLimitSeconds;
}

export function isSessionBudgetExhausted(session: GameSession): boolean {
  return session.questionsUsed >= session.questionBudget;
}

export function getGameSession(id: string): GameSession | undefined {
  return gameSessions.get(id);
}

export function completePartForSession(
  sessionId: string,
  partIndex: number
): void {
  const session = gameSessions.get(sessionId);
  if (!session) {
    throw new Error(`GameSession '${sessionId}' not found`);
  }
  if (!session.completedPartIndexes.includes(partIndex)) {
    session.completedPartIndexes.push(partIndex);
  }
}

export function updateGameSession(
  id: string,
  updater: (session: GameSession) => GameSession | void
): GameSession | undefined {
  const session = gameSessions.get(id);
  if (!session) return undefined;

  const result = updater(session) || session;
  gameSessions.set(id, result);
  return result;
}

export async function getGameSessionCompletion(
  sessionId: string
): Promise<number> {
  const session = gameSessions.get(sessionId);
  if (!session) {
    throw new Error(`GameSession '${sessionId}' not found`);
  }

  const puzzle: Puzzle | null = await getPuzzleFromDB(session.puzzleId);
  if (!puzzle) {
    throw new Error(`Puzzle '${session.puzzleId}' not found`);
  }

  const totalParts = puzzle.parts.length;
  if (totalParts === 0) {
    return 0;
  }

  console.log(`Session ${sessionId} has completed parts:`, session.completedPartIndexes);

  // Ensure no double-counting
  const uniqueCompleted = new Set(session.completedPartIndexes).size;

  console.log(`Session ${sessionId} completion: ${uniqueCompleted}/${totalParts}`);

  return uniqueCompleted / totalParts; // 0.0 – 1.0
}

export function deleteGameSession(id: string): void {
  gameSessions.delete(id);
}
