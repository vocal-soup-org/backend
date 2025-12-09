// src/storyRoutes.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import { ChatService } from "./Service/chatService"
import {Puzzle} from "./Schema/Puzzle"
import { StoryService } from "./Service/storyService";

export const storyRouter = Router();

type StartStoryResponseBody = {
  storySessionId: string;
};

const storyService = StoryService.getInstance();

storyRouter.post("/start", async (req, res) => {
  const { puzzleId, userId  } = req.body;
  try {
    const sessionId = randomUUID();
    await storyService.startSession({
      sessionId,
      puzzleId,
      userId,
    });
    const result: StartStoryResponseBody = {
      storySessionId: sessionId,
    };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/start:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


