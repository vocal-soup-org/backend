// StoryService.ts
import { getPuzzleFromDB } from "./puzzleService";
import { Puzzle } from "../Schema/Puzzle";
import {
  StorySession,
  createStorySession,
  getStorySession,
  updateStorySession,
  deleteStorySession,
} from "../storySession";

export class StoryService {
  private static _instance: StoryService | null = null;

  private constructor() {}

  public static getInstance(): StoryService {
    if (!this._instance) {
      this._instance = new StoryService();
    }
    return this._instance;
  }

  /** Create a new session that is tied to exactly one puzzle. */
  public async startSession(params: {
    sessionId: string;
    puzzleId: string;
    userId?: string;
  }): Promise<StorySession> {
    const { sessionId, puzzleId, userId } = params;

    // ensure puzzle exists, throws if not
    await this.requirePuzzle(puzzleId);

    const session = await createStorySession({
      id: sessionId,
      puzzleId,
      userId,
    });

    return session;
  }

  /** Get an existing session by id, or throw if missing */
  public requireSession(sessionId: string): StorySession {
    const session = getStorySession(sessionId);
    if (!session) {
      throw new Error(`StoryService: session '${sessionId}' not found`);
    }
    return session;
  }

  /** Get the puzzle that belongs to a session */
  public async getPuzzleForSession(sessionId: string): Promise<Puzzle> {
    const session = this.requireSession(sessionId);
    return this.requirePuzzle(session.puzzleId);
  }

  /** Low-level: ensure puzzle exists */
  public async requirePuzzle(puzzleId: string): Promise<Puzzle> {
    const puzzle = await getPuzzleFromDB(puzzleId);
    if (!puzzle) {
      throw new Error(`StoryService: puzzle '${puzzleId}' not found`);
    }
    return puzzle;
  }

  /** Update a session (e.g., add flags, timestamps, etc.) */
  public updateSession(
    sessionId: string,
    updater: (session: StorySession) => StorySession | void
  ): StorySession {
    const updated = updateStorySession(sessionId, updater);
    if (!updated) {
      throw new Error(
        `StoryService: cannot update, session '${sessionId}' not found`
      );
    }
    return updated;
  }

  /** End/cleanup a session */
  public endSession(sessionId: string): void {
    deleteStorySession(sessionId);
  }
}
