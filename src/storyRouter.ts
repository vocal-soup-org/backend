// src/storyRoutes.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import {
  createStorySession,
  getStorySession,
  deleteStorySession,
} from "./storySession";
import {Puzzle} from "./Schema/Puzzle"
import { getPuzzle } from "./Service/storyService";

export const storyRouter = Router();

type StartStoryResponseBody = {
  storySessionId: string;
};


storyRouter.post("/start", async (req, res) => {
  const { puzzleId } = req.body;
  try {
    const sessionId = randomUUID();
    createStorySession(sessionId, puzzleId);
    const result: StartStoryResponseBody = {
      storySessionId: sessionId,
    };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/start:", err);
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

    // TODO: implement logic to pass down final story to here
    const finalStory = "GET FROM DB";

    // Optional: cleanup session since it's done
    deleteStorySession(storySessionId);

    const result: FinalStoryResponseBody = { finalStory };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/final:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
