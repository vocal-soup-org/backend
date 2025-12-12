// src/gameRouter.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import { startSession } from "./Service/gameSessionService";

export const gameRouter = Router();

type StartGameRequestBody = {
  puzzleId: string;
  userId?: string;
};

type StartGameResponseBody = {
  sessionId: string;
};

// POST /game/start
// Creates a new game session for a puzzle
gameRouter.post("/start", async (req, res) => {
  const { puzzleId, userId } = req.body as StartGameRequestBody;

  if (!puzzleId) {
    return res.status(400).json({ error: "Missing puzzleId" });
  }

  try {
    const sessionId = randomUUID();
    await startSession({
      sessionId,
      puzzleId,
      userId,
    });

    const result: StartGameResponseBody = { sessionId };
    return res.json(result);
  } catch (err) {
    console.error("Error in /game/start:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
