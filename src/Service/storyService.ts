import {Puzzle} from "../Schema/Puzzle"

  // TODO: get Puzzle from DB
export function getPuzzle(id: string): Puzzle | null {
  return null;
}

export interface StorySession {
  id: string;
  userId?: string;
  puzzleId: string;             // <- tie to exactly one puzzle
}



export class StoryService {
  private static _instance: StoryService | null = null;

  // The single puzzle for this session
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

  /** Initialize or replace the puzzle for this session */
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

  private fetchPuzzleData(puzzleId: String): void {
    // TODO: DB connection
    // initializePuzzle();
  }

  /** Get the current puzzle (or null if not set yet) */
  public getPuzzle(): Puzzle | null {
    return this.m_puzzle;
  }

  /** Optional: throw if you expect a puzzle to always exist */
  public requirePuzzle(): Puzzle {
    if (!this.m_puzzle) {
      throw new Error("SessionService: puzzle not initialized");
    }
    return this.m_puzzle;
  }

  

public createStorySession(params: {
  id: string;
  puzzleId: string;
}): StorySession {
  const { id, puzzleId } = params;

  const session: StorySession = {
    id,
    puzzleId,
  };
  this.fetchPuzzleData(puzzleId);
  return session;
}


public getStorySession(id: string): StorySession | null {
  return this.m_session;
}

public updateStorySession(
  id: string,
  updater: (session: StorySession) => void
): StorySession | undefined {
  const session = this.m_session;
  if (!session) return undefined;
  updater(session);
  return session;
}

public clearStorySession() {
  this.m_session = null;
}

  /** Clear session puzzle (e.g. when game ends) */
  public clearPuzzle(): void {
    this.m_puzzle = null;
  }
}
