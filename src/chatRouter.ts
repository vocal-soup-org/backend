// src/chatRoutes.ts
import { Router } from "express";
import { openai } from "./aiClient";

export const chatRouter = Router();

type EvaluateRequestBody = {
  puzzleId: string;
  puzzlePrompt: string;
  answerKey: string;
  userAnswer: string;
};

type ChatResult = "yes" | "no" | "not_sure";

type EvaluateResponseBody = {
  result: ChatResult;
};


chatRouter.post(
  "/evaluate",
  async (req, res) => {
    const { puzzleId, puzzlePrompt, answerKey, userAnswer } =
      req.body as EvaluateRequestBody;

    if (!puzzleId || !puzzlePrompt || !answerKey || !userAnswer) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Prompt design: strict grader, JSON only
      const systemPrompt = `
You are grading answers to lateral thinking puzzles.
You will be given:
- the puzzle text
- the intended solution
- a player's answer

Rules:
- Respond ONLY with a JSON object.
- JSON format:
  {
    "result": "yes" | "no" | "not_sure"
  }
- "yes" (OBJECTIVELY CORRECT): The player's answer is factually correct based on the Intended Solution.
- "no" (OBJECTIVELY INCORRECT): The player's answer is factually not right based on the Intended Solution.
- "not_sure" (NOT RELATED): The player's answer addresses a topic or fact that is outside the defined scope of the Intended Solution
`;

      const userPrompt = `
Puzzle ID: ${puzzleId}

Puzzle:
${puzzlePrompt}

Intended solution or key idea:
${answerKey}

Player's answer:
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
        return res.status(500).json({ error: "Invalid AI response" });
      }

      if (
        parsed.result !== "yes" &&
        parsed.result !== "no" &&
        parsed.result !== "not_sure"
      ) {
        return res
          .status(500)
          .json({ error: "AI returned invalid result field" });
      }

      return res.json(parsed);
    } catch (err) {
      console.error("Error in /chat/evaluate:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);
