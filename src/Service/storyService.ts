import { Puzzle } from "../Schema/Puzzle";
import { getPuzzleFromDB } from "./puzzleService";



export interface StorySession {
  id: string;
  userId?: string;
  puzzleId: string; // one puzzle per session
}

export class StoryService {
  private static _instance: StoryService | null = null;

  // The single puzzle + session for this runtime
  private m_puzzle: Puzzle | null = null;
  private m_session: StorySession | null = null;

  private constructor() {}

  // Singleton accessor
  public static getInstance(): StoryService {
    if (!this._instance) {
      this._instance = new StoryService();
    }
    return this._instance;
  }

  /**
   * High-level entry point:
   * Create a story session AND load the puzzle it’s tied to.
   */
  public createStorySession(params: {
    id: string;
    puzzleId: string;
  }): StorySession {
    const { id, puzzleId } = params;

    const puzzle = this.loadPuzzle(puzzleId);
    const session: StorySession = {
      id,
      puzzleId,
    };

    this.m_session = session;
    this.m_puzzle = puzzle;

    return session;
  }

  /** Get the current story session (or null if not set yet) */
  public getStorySession(): StorySession | null {
    return this.m_session;
  }

  /** Require a session to exist (throws otherwise) */
  public requireStorySession(): StorySession {
    if (!this.m_session) {
      throw new Error("StoryService: story session not initialized");
    }
    return this.m_session;
  }

  /** Update the current story session in place */
  public updateStorySession(
    updater: (session: StorySession) => void
  ): StorySession | null {
    if (!this.m_session) return null;
    updater(this.m_session);
    return this.m_session;
  }

  /** Initialize or replace the puzzle for this session directly */
  public setPuzzle(puzzle: Puzzle): void {
    this.m_puzzle = puzzle;
  }

  /** Convenience: build and set the puzzle from raw fields */
  public initPuzzle(data: {
    id: string;
    title: string;
    content: string;
    fullAnswer: string;
    parts: string[];
    hint: string;
  }): void {
    this.m_puzzle = { ...data };
  }

  /** Internal: load puzzle from DB/store by ID and set it */
  private loadPuzzle(puzzleId: string): Puzzle {
    getPuzzleFromDB(puzzleId)
    .then((puzzle: Puzzle | null) => {
      if (puzzle) {
        return puzzle;
      }
    })
    .catch(error => {
      console.error("An error occurred:", error);
    });

    throw Error;
  }

  /** Get the current puzzle (or null if not set yet) */
  public getPuzzle(): Puzzle | null {
    return this.m_puzzle;
  }

  /** Throw if you expect a puzzle to always exist */
  public requirePuzzle(): Puzzle {
    if (!this.m_puzzle) {
      throw new Error("StoryService: puzzle not initialized");
    }
    return this.m_puzzle;
  }

  /** Clear everything (session + puzzle) */
  public reset(): void {
    this.m_session = null;
    this.m_puzzle = null;
  }
}
