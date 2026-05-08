// gameSessionService.ts
// Service for managing game sessions and recording puzzle progress

import { getPuzzleFromDB } from "./puzzleService";
import { evaluateAnswerForParts } from "./evaluationService";
import { Puzzle } from "../Schema/Puzzle";
import {
  GameSession,
  createGameSession,
  getGameSession,
  updateGameSession,
  deleteGameSession,
  completePartForSession,
} from "../gameSession";

/**
 * Start a new game session tied to a specific puzzle.
 */
export async function startSession(params: {
  sessionId: string;
  gameId: string;
  puzzleId: string;
  userId?: string;
  language?: string;
}): Promise<GameSession> {
  const { sessionId, gameId, puzzleId, userId, language = 'en' } = params;

  // Ensure puzzle exists (createGameSession also checks, but we want clear error)
  const puzzle = await getPuzzleFromDB(puzzleId);
  if (!puzzle) {
    throw new Error(`GameSessionService: puzzle '${puzzleId}' not found`);
  }

  return createGameSession({
    id: sessionId,
    gameId,
    puzzleId,
    userId,
    language,
  });
}

/**
 * Get an existing session by ID, or throw if not found.
 */
export function requireSession(sessionId: string): GameSession {
  const session = getGameSession(sessionId);
  if (!session) {
    throw new Error(`GameSessionService: session '${sessionId}' not found`);
  }
  return session;
}

/**
 * Get the puzzle associated with a session.
 */
export async function getPuzzleForSession(sessionId: string): Promise<Puzzle> {
  const session = requireSession(sessionId);
  const puzzle = await getPuzzleFromDB(session.puzzleId, session.language);
  if (!puzzle) {
    throw new Error(`GameSessionService: puzzle '${session.puzzleId}' not found`);
  }
  return puzzle;
}

/**
 * Record a successful clue/answer and update which parts of the puzzle are solved.
 */
export async function recordSuccessfulAnswer(
  sessionId: string,
  answer: string
): Promise<void> {
  const session = requireSession(sessionId);
  const puzzle = await getPuzzleForSession(sessionId);

  // Use AI to evaluate which parts the answer solves
  const solvedPartIndexes = await evaluateAnswerForParts(answer, puzzle.parts, puzzle.content);

  // Mark solved parts in the session
  for (const partIndex of solvedPartIndexes) {
    console.log(`Session ${sessionId}: marking part ${partIndex} as completed.`);
    completePartForSession(sessionId, partIndex);
  }
}

/**
 * Update a session with custom logic.
 */
export function updateSession(
  sessionId: string,
  updater: (session: GameSession) => GameSession | void
): GameSession {
  const updated = updateGameSession(sessionId, updater);
  if (!updated) {
    throw new Error(`GameSessionService: cannot update, session '${sessionId}' not found`);
  }
  return updated;
}

/**
 * End and cleanup a session.
 */
export function endSession(sessionId: string): void {
  deleteGameSession(sessionId);
}
