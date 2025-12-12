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
  parts: string[]
): Promise<number[]> {
  if (!answer || parts.length === 0) {
    return [];
  }

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

  try {
    const aiResult = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

    const text = aiResult.output_text;
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
