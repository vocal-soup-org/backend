// src/gameRouter.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import { startSession } from "./Service/gameSessionService";
import { getAllGames, getGameById, createGame } from "./Service/gameService";
import { Game } from "./Schema/Game";

export const gameRouter = Router();

type StartGameRequestBody = {
  puzzleId: string;
  userId?: string;
};

type StartGameResponseBody = {
  sessionId: string;
};

// GET /game/list
// Returns all games in the catalog
gameRouter.get("/list", async (_req, res) => {
  try {
    const games = await getAllGames();
    return res.json(games);
  } catch (err) {
    console.error("Error in /game/list:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /game/:id
// Returns a single game by ID
gameRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const game = await getGameById(id);
    return res.json(game);
  } catch (err) {
    console.error("Error in /game/:id:", err);
    return res.status(404).json({ error: "Game not found" });
  }
});

// POST /game/add
// Creates a new game entry in the catalog
gameRouter.post("/add", async (req, res) => {
  const { id, status, level, genre, backgroundPicture, shortIntro, puzzleId, progress } =
    req.body as Game;

  if (!id || !status || !level || !genre || !shortIntro || !puzzleId) {
    return res.status(400).json({ error: "Missing required game fields" });
  }

  try {
    const game = await createGame({ id, status, level, genre, backgroundPicture, shortIntro, puzzleId, progress });
    return res.status(201).json(game);
  } catch (err) {
    console.error("Error in /game/add:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
