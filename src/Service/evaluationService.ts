// evaluationService.ts
// Stateless service for AI-powered answer evaluation

import { openai } from "../aiClient";
import { Puzzle } from "../Schema/Puzzle";

export type EvaluationResult = "yes" | "no" | "not_sure" | "not_related";

interface EvaluateResponseBody {
  result: EvaluationResult;
}

interface PartsEvaluationResponse {
  solved: number[];
}

/**
 * Evaluates a user's answer against a puzzle's full answer.
 * Returns whether the answer is correct, incorrect, uncertain, or unrelated.
 */
export async function evaluateAnswer(
  userAnswer: string,
  puzzle: Puzzle
): Promise<EvaluationResult | null> {
  if (!puzzle.content || !puzzle.fullAnswer || !userAnswer) {
    console.error("Missing required fields for evaluation");
    return null;
  }

  try {
    const systemPrompt = `
You are an evaluator for a lateral thinking puzzle game.

You will be given the puzzle scenario, the full answer, and the player's guess.

Rules:
- Respond ONLY with a JSON object.
- JSON format:
  {
    "result": "yes" | "no" | "not_sure" | "not_related"
  }
- "yes": the player's guess correctly identifies or strongly implies the answer
- "no": the player's guess is clearly wrong
- "not_sure": the guess is partially correct or ambiguous
- "not_related": the guess is off-topic or unrelated to the puzzle
`;

    const userPrompt = `
Puzzle scenario:
${puzzle.content}

Full answer:
${puzzle.fullAnswer}

Player's guess:
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

    const text = response.output_text.replace(/```json|```/g, "").trim();
    let parsed: EvaluateResponseBody;

    try {
      parsed = JSON.parse(text) as EvaluateResponseBody;
    } catch (err) {
      console.error("Failed to parse JSON from evaluation AI:", text);
      return null;
    }

    const validResults: EvaluationResult[] = ["yes", "no", "not_sure", "not_related"];
    if (!validResults.includes(parsed.result)) {
      console.error("Invalid evaluation result:", parsed.result);
      return null;
    }

    return parsed.result;
  } catch (err) {
    console.error("Error in evaluateAnswer:", err);
    return null;
  }
}

/**
 * Evaluates which parts of a puzzle solution the user's answer satisfies.
 * Returns an array of indexes for the solved parts.
 */
export async function evaluateAnswerForParts(
  answer: string,
  parts: string[],
  puzzleContent: string
): Promise<number[]> {
  if (!answer || parts.length === 0) {
    return [];
  }

  const systemPrompt = `
You are an evaluator for a lateral thinking puzzle game.

You will be given:
1. The puzzle scenario — the surface story shown to players
2. The user's answer/question
3. A list of key solution parts. Each part represents a key idea required to fully solve the puzzle.

Your task:
- Compare the user's answer to EACH solution part.
- A part is considered solved if the user's answer clearly expresses the same idea, even if wording differs.
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
Puzzle scenario:
${puzzleContent}

User answer:
"${answer}"

Solution parts (indexed):
${parts.map((p, i) => `${i}: ${p}`).join("\n")}
`;

  try {
    const aiResult = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

    const text = aiResult.output_text.replace(/```json|```/g, "").trim();
    console.log("AI parts evaluation response:", text);

    let parsed: PartsEvaluationResponse;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse JSON from parts evaluation AI:", text);
      return [];
    }

    return parsed.solved ?? [];
  } catch (err) {
    console.error("Error in evaluateAnswerForParts:", err);
    return [];
  }
}
