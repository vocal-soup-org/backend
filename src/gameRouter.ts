// src/gameRouter.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import fs from "fs";
import os from "os";
import { startSession, recordSuccessfulAnswer } from "./Service/gameSessionService";
import { getAllGames, getGameById, createGame } from "./Service/gameService";
import { getPuzzleFromDB } from "./Service/puzzleService";
import { evaluateAnswer } from "./Service/evaluationService";
import { getGameSession, getGameSessionCompletion } from "./gameSession";
import { openai } from "./aiClient";
import { Game } from "./Schema/Game";

export const gameRouter = Router();

// Multer for temporary audio file storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ".m4a");
  },
});
const upload = multer({ storage });

// ─── Game Catalog ────────────────────────────────────────────────

// GET /v1/games
// Returns the full game catalog (metadata only — no puzzle content)
gameRouter.get("/", async (_req, res) => {
  try {
    const games = await getAllGames();
    return res.json(games);
  } catch (err) {
    console.error("Error in GET /v1/games:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/games/:id
// Returns a single game by ID
gameRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const game = await getGameById(id);
    return res.json(game);
  } catch (err) {
    console.error("Error in GET /v1/games/:id:", err);
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

// ─── Game Session ────────────────────────────────────────────────

// POST /game/start
// Starts a session for a game — looks up the game's linked puzzle automatically
gameRouter.post("/start", async (req, res) => {
  const { gameId, userId } = req.body as { gameId: string; userId?: string };

  if (!gameId) {
    return res.status(400).json({ error: "Missing gameId" });
  }

  try {
    const game = await getGameById(gameId);
    const sessionId = randomUUID();
    await startSession({ sessionId, puzzleId: game.puzzleId, userId });
    return res.json({ sessionId });
  } catch (err) {
    console.error("Error in /game/start:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /game/evaluate
// Evaluates a text answer against the session's puzzle and tracks progress
gameRouter.post("/evaluate", async (req, res) => {
  const { sessionId, userAnswer } = req.body as { sessionId: string; userAnswer: string };

  if (!sessionId || !userAnswer) {
    return res.status(400).json({ error: "Missing sessionId or userAnswer" });
  }

  const session = getGameSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    const puzzle = await getPuzzleFromDB(session.puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    const evaluation = await evaluateAnswer(userAnswer, puzzle);
    if (evaluation === "yes") {
      await recordSuccessfulAnswer(sessionId, userAnswer);
    }

    const completion = await getGameSessionCompletion(sessionId);
    return res.json({ evaluation, completion });
  } catch (err) {
    console.error("Error in /game/evaluate:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /game/transcribe
// Transcribes audio, evaluates the answer, and tracks session progress
gameRouter.post("/transcribe", upload.single("audioFile"), async (req, res) => {
  const { sessionId } = req.query;
  const tempFilePath = req.file?.path;

  if (!tempFilePath) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }

  if (typeof sessionId !== "string" || !sessionId) {
    return res.status(400).json({ success: false, error: "Missing sessionId query parameter." });
  }

  const session = getGameSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found." });
  }

  try {
    const audioStream = fs.createReadStream(tempFilePath);
    const transcript = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioStream as any,
    });

    console.log("Transcription:", transcript.text);

    const puzzle = await getPuzzleFromDB(session.puzzleId);
    if (!puzzle) {
      return res.status(404).json({ success: false, error: "Puzzle not found." });
    }

    const evaluation = await evaluateAnswer(transcript.text, puzzle);
    if (evaluation === "yes") {
      await recordSuccessfulAnswer(sessionId, transcript.text);
    }

    const completion = await getGameSessionCompletion(sessionId);
    return res.json({ success: true, transcript: transcript.text, evaluation, completion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in /game/transcribe:", message);
    return res.status(500).json({ success: false, error: "Transcription failed.", details: message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Cleaned up temp file: ${tempFilePath}`);
    }
  }
});
