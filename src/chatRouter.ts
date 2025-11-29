// src/chatRoutes.ts
import { Router } from "express";
import { openai } from "./aiClient";
import { ChatService } from "./Service/chatService";

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
    const { puzzleId, userAnswer } =
      req.body as EvaluateRequestBody;
    const chatService = ChatService.getInstance();
    const puzzle = chatService.getPuzzle();
    if (!puzzleId || !puzzlePrompt || !answerKey || !userAnswer) {
      return res.status(400).json({ error: "Missing required fields" });
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
${puzzlePrompt}

汤底:
${answerKey}

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
        return res.status(500).json({ error: "Invalid AI response" });
      }

      if (
        parsed.result !== "yes" &&
        parsed.result !== "no" &&
        parsed.result !== "not_sure" &&
        parsed.result !== "not_related"
      ) {
        return res
          .status(500)
          .json({ error: "AI returned invalid result field" });
      }

      // TODO: send the user's answer to Completion AI to evaluate
      

      return res.json(parsed);
    } catch (err) {
      console.error("Error in /chat/evaluate:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);
