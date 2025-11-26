// src/storyRoutes.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import { openai } from "./aiClient";
import {
  StoryMessage,
  createStorySession,
  getStorySession,
  updateStorySession,
  deleteStorySession,
} from "./storySession";

export const storyRouter = Router();

// 1) Start story session

type StartStoryRequestBody = {
  puzzles: { id: string; title: string; summary: string }[];
  storyPremise: string;
};

type StartStoryResponseBody = {
  storySessionId: string;
  openingText: string;
};

storyRouter.post("/start", async (req, res) => {
  const { puzzles, storyPremise } = req.body as StartStoryRequestBody;

  if (!puzzles || !Array.isArray(puzzles) || puzzles.length === 0) {
    return res.status(400).json({ error: "puzzles array is required" });
  }
  if (!storyPremise) {
    return res.status(400).json({ error: "storyPremise is required" });
  }

  try {
    const systemContent = `
You are a narrative engine for a puzzle-based adventure game.

Context:
- The player will solve a short sequence of puzzles.
- Each correct solution advances the story.
- You will receive messages describing the player's correct ideas.
- Your job is to weave those into a single coherent adventure.

Tone:
- Lightly cinematic, 2-4 sentences per update.
- Keep it grounded in the puzzle actions, not random new events.
- Don't reveal future puzzles before the player reaches them.

Behavior:
- For the first call, write an opening scene that:
  - Introduces the protagonist.
  - Hints at the overall quest or mystery.
  - Does NOT mention specific puzzle solutions yet.

- On later calls (handled by other endpoints), you will get messages like:
  "The hero realized X and did Y".
  You will then add a new short scene reflecting that success.

Do NOT explain the rules. Just tell the story.
`;

    const puzzlesSummary = puzzles
      .map((p, idx) => `${idx + 1}. [${p.id}] ${p.title} — ${p.summary}`)
      .join("\n");

    const userContent = `
Story premise:
${storyPremise}

Puzzles (in order):
${puzzlesSummary}

Write the opening scene now. 2–4 sentences, present or past tense, your choice.
`;

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    });

    const openingText = response.output_text.trim();
    const sessionId = randomUUID();

    const initialMessages: StoryMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
      { role: "assistant", content: openingText },
    ];

    createStorySession(sessionId, initialMessages /*, optional userId */);

    const result: StartStoryResponseBody = {
      storySessionId: sessionId,
      openingText,
    };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/start:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 2) Append correct answer to story

type AppendStoryRequestBody = {
  storySessionId: string;
  puzzleId: string;
  userCorrectIdea: string;
  puzzleSummary: string;
};

type AppendStoryResponseBody = {
  storyChunk: string;
};

storyRouter.post("/append", async (req, res) => {
  const { storySessionId, puzzleId, userCorrectIdea, puzzleSummary } =
    req.body as AppendStoryRequestBody;

  if (!storySessionId || !puzzleId || !userCorrectIdea || !puzzleSummary) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const session = getStorySession(storySessionId);
  if (!session) {
    return res.status(404).json({ error: "Story session not found" });
  }

  try {
    const userMessage: StoryMessage = {
      role: "user",
      content: `
The player has just correctly solved puzzle "${puzzleId}".

Puzzle summary:
${puzzleSummary}

Correct idea (paraphrase this in the story, do not repeat verbatim):
${userCorrectIdea}

Write the next short scene (2–4 sentences) showing how this success advances the adventure.
Do NOT recap the entire story, just continue from where we left off.
      `.trim(),
    };

    updateStorySession(storySessionId, (s) => {
      s.messages.push(userMessage);
    });

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: session.messages.concat(userMessage),
    });

    const storyChunk = response.output_text.trim();

    updateStorySession(storySessionId, (s) => {
      s.messages.push({ role: "assistant", content: storyChunk });
    });

    const result: AppendStoryResponseBody = { storyChunk };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/append:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 3) Final story

type FinalStoryRequestBody = {
  storySessionId: string;
};

type FinalStoryResponseBody = {
  finalStory: string;
};

storyRouter.post("/final", async (req, res) => {
  const { storySessionId } = req.body as FinalStoryRequestBody;

  if (!storySessionId) {
    return res.status(400).json({ error: "storySessionId is required" });
  }

  const session = getStorySession(storySessionId);
  if (!session) {
    return res.status(404).json({ error: "Story session not found" });
  }

  try {
    const finalUserMessage: StoryMessage = {
      role: "user",
      content: `
We have finished all puzzles in this adventure.

Please now tell the full story of the adventure so far in a single coherent narrative.
You may reuse and refine previous scenes, but present the story as one continuous tale.
Aim for 5–10 paragraphs, not bullet points.
      `.trim(),
    };

    const messages = session.messages.concat(finalUserMessage);

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: messages,
    });

    const finalStory = response.output_text.trim();

    // Optional: cleanup session since it's done
    deleteStorySession(storySessionId);

    const result: FinalStoryResponseBody = { finalStory };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/final:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
