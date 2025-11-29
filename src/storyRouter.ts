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


storyRouter.post("/start", async (req, res) => {
  const { puzzleId } = req.body;
  const puzzleIdAsString = puzzleId.toString();
  try {
    const sessionId = randomUUID();
    const chatService = ChatService.getInstance();
    const storyService = StoryService.getInstance();
    storyService.createStorySession( {id: sessionId, puzzleId: puzzleIdAsString} );
    chatService.createChatSession( {id: sessionId, puzzleId: puzzleIdAsString} );
    const result: StartStoryResponseBody = {
      storySessionId: sessionId,
    };
    return res.json(result);
  } catch (err) {
    console.error("Error in /story/start:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


