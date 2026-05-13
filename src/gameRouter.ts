// src/gameRouter.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import fs from "fs";
import os from "os";
import { startSession, recordSuccessfulAnswer } from "./Service/gameSessionService";
import { getAllGames, getGameById, createGame, updateGame } from "./Service/gameService";
import { getPuzzleFromDB } from "./Service/puzzleService";
import { getOrCreateUserProfile, updateUserLanguage, markGameCompleted, awardXpAndLevelUp } from "./Service/userService";
import { evaluateAnswer } from "./Service/evaluationService";
import { generateHint } from "./Service/hintService";
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

// PATCH /v1/games/:id
// Updates specific fields of a game (e.g. backgroundPicture, status, progress)
gameRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const game = await updateGame(id, req.body);
    return res.json(game);
  } catch (err) {
    console.error("Error in PATCH /v1/games/:id:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /game/add
// Creates a new game entry in the catalog
gameRouter.post("/add", async (req, res) => {
  const { id, status, level, genre, name, shortIntro, puzzleId } =
    req.body as Game;

  if (!id || !status || !level || !genre || !shortIntro || !puzzleId) {
    return res.status(400).json({ error: "Missing required game fields" });
  }

  try {
    const game = await createGame({ id, status, level, genre, name, shortIntro, puzzleId, experience: 0 });
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
  const { gameId, userId, language } = req.body as { gameId: string; userId?: string; language?: string };

  if (!gameId) {
    return res.status(400).json({ error: "Missing gameId" });
  }

  try {
    const game = await getGameById(gameId);
    const sessionId = randomUUID();

    let resolvedLanguage = language;
    if (userId) {
      const profile = await getOrCreateUserProfile(userId);
      if (resolvedLanguage) {
        // Persist the language choice if it changed
        if (resolvedLanguage !== profile.language) {
          await updateUserLanguage(userId, resolvedLanguage);
        }
      } else {
        // Fall back to what's stored for this user
        resolvedLanguage = profile.language;
      }
    }

    await startSession({ sessionId, gameId, puzzleId: game.puzzleId, userId, language: resolvedLanguage });
    const puzzle = await getPuzzleFromDB(game.puzzleId, resolvedLanguage);
    return res.json({ sessionId, puzzle });
  } catch (err) {
    console.error("Error in /game/start:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("not found")) {
      return res.status(404).json({ error: `Game '${gameId}' not found` });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /v1/games/hint
// Generates a dynamic hint based on the player's current session progress
gameRouter.post("/hint", async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  const session = getGameSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    const puzzle = await getPuzzleFromDB(session.puzzleId, session.language);
    if (!puzzle) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    const hint = await generateHint(puzzle, session.completedPartIndexes, session.language);
    if (hint === null) {
      return res.status(502).json({ error: "Hint service failed. Please try again." });
    }

    return res.json({ hint });
  } catch (err) {
    console.error("Error in /game/hint:", err);
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
    const puzzle = await getPuzzleFromDB(session.puzzleId, session.language);
    if (!puzzle) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    const evaluation = await evaluateAnswer(userAnswer, puzzle);
    if (evaluation === null) {
      return res.status(502).json({ error: "Evaluation service failed. Please try again." });
    }

    if (evaluation === "yes") {
      await recordSuccessfulAnswer(sessionId, userAnswer);
      const completion = await getGameSessionCompletion(sessionId);

      let leveledUp = false;
      let newLevel: number | undefined;
      let xpGained = 0;
      if (completion === 1 && session.userId) {
        await markGameCompleted(session.userId, session.gameId);
        const result = await awardXpAndLevelUp(session.userId, session.gameId);
        leveledUp = result.leveledUp;
        newLevel = result.profile.level;
        xpGained = result.xpGained;
      }

      return res.json({ evaluation, completion, leveledUp, newLevel, xpGained });
    }

    const completion = await getGameSessionCompletion(sessionId);
    return res.json({ evaluation, completion, leveledUp: false, xpGained: 0 });
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

    const puzzle = await getPuzzleFromDB(session.puzzleId, session.language);
    if (!puzzle) {
      return res.status(404).json({ success: false, error: "Puzzle not found." });
    }

    const evaluation = await evaluateAnswer(transcript.text, puzzle);
    if (evaluation === null) {
      return res.status(502).json({ success: false, error: "Evaluation service failed. Please try again." });
    }

    if (evaluation === "yes") {
      await recordSuccessfulAnswer(sessionId, transcript.text);
      const completion = await getGameSessionCompletion(sessionId);

      let leveledUp = false;
      let newLevel: number | undefined;
      let xpGained = 0;
      if (completion === 1 && session.userId) {
        await markGameCompleted(session.userId, session.gameId);
        const result = await awardXpAndLevelUp(session.userId, session.gameId);
        leveledUp = result.leveledUp;
        newLevel = result.profile.level;
        xpGained = result.xpGained;
      }

      return res.json({ success: true, transcript: transcript.text, evaluation, completion, leveledUp, newLevel, xpGained });
    }

    const completion = await getGameSessionCompletion(sessionId);
    return res.json({ success: true, transcript: transcript.text, evaluation, completion, leveledUp: false });
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
