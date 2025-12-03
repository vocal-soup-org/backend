
import { Puzzle } from "../Schema/Puzzle";
import { getPuzzleFromDB } from "./puzzleService";
import { openai } from "../aiClient";

// TODO: get Puzzle from DB or in-memory store
export function getPuzzle(id: string): Puzzle | null {
  // Example placeholder:
  // return inMemoryPuzzleMap.get(id) ?? null;
  return null;
}
type ChatResult = "yes" | "no" | "not_sure";

type EvaluateResponseBody = {
  result: ChatResult;
};

export interface ChatSession {
  id: string;
  puzzleId: string;            // one puzzle per session
  lastUserAnswer?: string;
}

export class ChatService {
  private static _instance: ChatService | null = null;

  private m_puzzle: Puzzle | null = null;
  private m_session: ChatSession | null = null;

  private constructor() {}

  // Singleton accessor
  public static getInstance(): ChatService {
    if (!this._instance) {
      this._instance = new ChatService();
    }
    return this._instance;
  }

  /**
   * High-level entry point:
   * create a ChatSession AND load the puzzle it’s tied to.
   */
  public createChatSession(params: {
    id: string;
    puzzleId: string;
  }): ChatSession {
    const { id, puzzleId } = params;

    const puzzle = this.loadPuzzle(puzzleId);
    const session: ChatSession = {
      id,
      puzzleId,
    };

    this.m_session = session;
    this.m_puzzle = puzzle;

    return session;
  }

  /** Get the current chat session (or null if not set yet) */
  public getChatSession(): ChatSession | null {
    return this.m_session;
  }

  /** Require a chat session to exist (throws otherwise) */
  public requireChatSession(): ChatSession {
    if (!this.m_session) {
      throw new Error("ChatService: chat session not initialized");
    }
    return this.m_session;
  }

  /** Update the current chat session in place */
  public updateChatSession(
    updater: (session: ChatSession) => void
  ): ChatSession | null {
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
      throw new Error("ChatService: puzzle not initialized");
    }
    return this.m_puzzle;
  }

  /** Clear everything (session + puzzle) */
  public reset(): void {
    this.m_session = null;
    this.m_puzzle = null;
  }

  public async evaluateAnswer(userAnswer: string): Promise<string> {
    const puzzleId = "silentConcert";
    const puzzle: Puzzle = await getPuzzleFromDB(puzzleId);
        if (!puzzleId || !puzzle.title || !puzzle.fullAnswer || !userAnswer) {
          return "";
        }
    
        try {
          // Prompt design: strict grader, JSON only
          const systemPrompt = `
    现在我们要玩海龟汤，我会给你提供三个东西：
    1. 汤面
    2. 汤底
    3. 玩家的猜测
    
    Rules:
    - Respond ONLY with a JSON object.
    - JSON format:
      {
        "result": "yes" | "no" | "not_sure" | "not_related"
      }
    
    `;
    
    const userPrompt = `
    
    汤面:
    ${puzzle.content}
    
    汤底:
    ${puzzle.fullAnswer}
    
    玩家的猜测:
    ${userAnswer}
    
    Now grade the answer strictly following the JSON format.
    `;
    
          const response = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          });
    
          const text = response.output_text;
          let parsed: EvaluateResponseBody;
    
          try {
            parsed = JSON.parse(text) as EvaluateResponseBody;
          } catch (err) {
            console.error("Failed to parse JSON from Chat AI:", text);
            return "";
          }
    
          if (
            parsed.result !== "yes" &&
            parsed.result !== "no" &&
            parsed.result !== "not_sure" &&
            parsed.result !== "not_related"
          ) {
            return "";
          }
    
          // TODO: send the user's answer to Completion AI to evaluate
          
    
          return parsed.result;
        } catch (err) {
          console.error("Error in /chat/evaluate:", err);
          return "";
        }
  }
}
