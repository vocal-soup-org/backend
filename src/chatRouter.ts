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
  explanation: string;
};

// POST route to send a simple message to the OpenAI model
chatRouter.post(
  "/hello",
  async (req, res) => {
    // 1. Get the user's message from the request body
    const { userMessage } = req.body; 

    // 2. Basic input validation
    if (!userMessage) {
      return res.status(400).json({ error: "Missing required field: userMessage" });
    }

    try {

      // 4. Call the OpenAI API
      const response = await openai.responses.create({
        model: "gpt-4o-mini", // A cost-effective model for simple tasks
        input: [
            { role: "system", content: "You are a friendly and concise greeter. Respond in one sentence." },
            { role: "user", content: userMessage },
        ],
      });

      // 5. Extract the AI's response text
      // The response structure for chat completions uses choices[0].message.content
      const aiResponse = response.output_text;

      // 6. Send the AI's response back to the client
      return res.json({ 
        message: "Request processed successfully.",
        aiReply: aiResponse 
      });

    } catch (err) {
      // 7. Handle API errors (including 429 quota errors)
      console.error("Error in /hello endpoint:", err);
      // Check for status and return a user-friendly error
    }
  }
);

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

Decide if the player's answer captures the core idea of the intended solution.

Rules:
- Respond ONLY with a JSON object.
- JSON format:
  {
    "result": "yes" | "no" | "not_sure",
    "explanation": "short, 1-2 sentences why you chose that result"
  }
- "yes": they captured the key idea even if wording is informal.
- "no": they are clearly wrong or describing a different idea.
- "not_sure": answer is ambiguous / off-topic and you can't reliably grade it.
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
