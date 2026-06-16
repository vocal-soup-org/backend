// gameSessionService.ts
// Service for managing game sessions and recording puzzle progress

import { getPuzzleFromDB } from "./puzzleService";
import { evaluateAnswerForParts } from "./evaluationService";
import { calculateCoins, getBudgetForAttempt, getTimeLimitForLevel } from "./coinService";
import { getGameById } from "./gameService";
import { awardCoins, completeGameAndAwardRewards, getGameProgress, updateGameProgressStats } from "./userService";
import { supabaseAdmin } from "../supabaseAdmin";
import { Puzzle } from "../Schema/Puzzle";
import {
  GameSession,
  createGameSession,
  getGameSession,
  updateGameSession,
  deleteGameSession,
  completePartForSession,
  getElapsedSeconds,
  getGameSessionCompletion,
  getQuestionsRemaining,
  incrementQuestionCount,
  isSessionBudgetExhausted,
  isSessionTimedOut,
} from "../gameSession";

export type SessionEndReason = "completed" | "exhausted" | "timeout";

export class SessionLimitError extends Error {
  readonly reason: Exclude<SessionEndReason, "completed">;

  constructor(reason: Exclude<SessionEndReason, "completed">) {
    super(reason === "timeout" ? "Session time limit reached" : "Session question budget exhausted");
    this.name = "SessionLimitError";
    this.reason = reason;
  }
}

export interface EndSessionResult {
  coinsEarned: number;
  completion: number;
  score: number;
  questionsRemaining: number;
  leveledUp: boolean;
  newLevel?: number;
  xpAwarded?: number;
}

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

  const game = await getGameById(gameId);
  const progress = userId ? await getGameProgress(userId, gameId) : null;
  const attemptNumber = (progress?.attemptsUsed ?? 0) + 1;
  const questionBudget = getBudgetForAttempt(game.level, attemptNumber);
  const timeLimitSeconds = getTimeLimitForLevel(game.level);

  return createGameSession({
    id: sessionId,
    gameId,
    puzzleId,
    userId,
    language,
    attemptNumber,
    questionBudget,
    timeLimitSeconds,
  });
}

/**
 * Get an existing session by ID, or throw if not found.
 */
function requireStoredSession(sessionId: string): GameSession {
  const session = getGameSession(sessionId);
  if (!session) {
    throw new Error(`GameSessionService: session '${sessionId}' not found`);
  }
  return session;
}

export function requireSession(sessionId: string): GameSession {
  const session = requireStoredSession(sessionId);
  if (isSessionTimedOut(session)) {
    throw new SessionLimitError("timeout");
  }
  if (session.questionsUsed >= session.questionBudget) {
    throw new SessionLimitError("exhausted");
  }
  return session;
}

export function getSessionStatus(session: GameSession): {
  questionsRemaining: number;
  sessionEnded: boolean;
  timedOut: boolean;
} {
  const timedOut = isSessionTimedOut(session);
  return {
    questionsRemaining: getQuestionsRemaining(session),
    sessionEnded: timedOut || isSessionBudgetExhausted(session),
    timedOut,
  };
}

export function recordQuestionUse(sessionId: string): GameSession {
  const session = requireSession(sessionId);
  return incrementQuestionCount(session.id);
}

/**
 * Get the puzzle associated with a session.
 */
export async function getPuzzleForSession(sessionId: string): Promise<Puzzle> {
  const session = requireStoredSession(sessionId);
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
  requireStoredSession(sessionId);
  const puzzle = await getPuzzleForSession(sessionId);

  // Use AI to evaluate which parts the answer solves
  const solvedPartIndexes = await evaluateAnswerForParts(answer, puzzle.parts, puzzle.content);

  // Mark solved parts in the session
  for (const partIndex of solvedPartIndexes) {
    console.log(`Session ${sessionId}: marking part ${partIndex} as completed.`);
    completePartForSession(sessionId, partIndex);
  }
}

export async function endSession(
  sessionId: string,
  reason: SessionEndReason
): Promise<EndSessionResult> {
  const session = getGameSession(sessionId);
  if (!session) {
    throw new Error(`GameSessionService: session '${sessionId}' not found`);
  }

  const completion = await getGameSessionCompletion(sessionId);
  const game = await getGameById(session.gameId);
  const elapsedSeconds = getElapsedSeconds(session);
  const score = Math.round(completion * 100);
  const coinsEarned = session.userId
    ? calculateCoins(
        game.level,
        session.attemptNumber,
        completion,
        session.questionsUsed,
        session.questionBudget,
        elapsedSeconds,
        session.timeLimitSeconds
      )
    : 0;

  let leveledUp = false;
  let newLevel: number | undefined;
  let xpAwarded: number | undefined;

  if (session.userId) {
    if (reason === "completed") {
      const reward = await completeGameAndAwardRewards(session.userId, session.gameId);
      leveledUp = reward.leveledUp;
      newLevel = reward.newLevel;
      xpAwarded = reward.xpAwarded;
    }

    const { error: scoreError } = await supabaseAdmin
      .from("game_scores")
      .insert({
        user_id: session.userId,
        game_id: session.gameId,
        score,
        coins_earned: coinsEarned,
        attempt_number: session.attemptNumber,
        completion,
      });

    if (scoreError) {
      console.error("Error recording game score:", scoreError);
      throw new Error(`GameSessionService: failed to record score for session '${sessionId}'`);
    }

    await updateGameProgressStats(session.userId, session.gameId, {
      attemptsUsed: session.attemptNumber,
      bestScore: score,
      bestCompletion: completion,
      completed: reason === "completed",
    });

    if (coinsEarned > 0) {
      await awardCoins(session.userId, coinsEarned);
    }
  }

  deleteGameSession(sessionId);

  return {
    coinsEarned,
    completion,
    score,
    questionsRemaining: 0,
    leveledUp,
    newLevel,
    xpAwarded,
  };
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
export function discardSession(sessionId: string): void {
  deleteGameSession(sessionId);
}
