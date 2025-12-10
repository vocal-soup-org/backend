// StoryService.ts
import { getPuzzleFromDB } from "./puzzleService";
import { Puzzle } from "../Schema/Puzzle";
import { openai } from "../aiClient";
import {
  StorySession,
  createStorySession,
  getStorySession,
  updateStorySession,
  deleteStorySession,
  completePartForSession
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

  public async recordSuccessfulClue(sessionId: string, answer: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const puzzle = await this.requirePuzzle(session.puzzleId);

    // use AI to evaluate if the answer solves any part
    // Send AI the answer and the parts, return which parts are solved (indexes)
    const solvedPartIndexes: number[] = await this.evaluateAnswerForParts(answer, puzzle.parts);
    // Update session to mark these parts as completed
    for (const partIndex of solvedPartIndexes) {
      console.log(`Session ${sessionId}: marking part ${partIndex} as completed.`);
      completePartForSession(sessionId, partIndex);
    }
  }


  public async evaluateAnswerForParts(answer: string,parts: string[]): Promise<number[]> {

  const systemPrompt = `
You are an evaluator that checks whether a user's answer satisfies any parts of a puzzle solution.

You will be given:
1. The user's answer (a free-form natural language response)
2. A list of puzzle solution parts. Each part represents a key idea required to solve the puzzle.

Your task:
- Compare the user's answer to EACH puzzle part.
- A puzzle part is considered solved if the user's answer clearly expresses the same idea, even if wording differs.
- Use semantic understanding, not just keyword matching.
- DO NOT require exact phrasing.
- DO NOT be overly strict; if the idea is present, count it.

Output:
- Respond ONLY with a JSON object in the following format:
  
  {
    "solved": [<indexes of solved parts>]
  }

Where:
- Indexes correspond to their position in the parts array (0-based).
- If no parts are solved, return an empty array.

No explanation. No additional commentary.
`;

const userPrompt = `

User answer:
"${answer}"

Puzzle parts (indexed):
${parts.map((p, i) => `${i}: ${p}`).join("\n")}
`;

  const aiResult = await openai.responses.create({
    model: "gpt-4.1",
    input: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
    temperature: 0.2,});

  let parsed: { solved: number[] };
  const text = aiResult.output_text;
  console.log("AI evaluation response:", text);
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse JSON from Chat AI:", text);
    return [];
  }

  return parsed.solved ?? [];

}


  
}
