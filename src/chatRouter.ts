// src/chatRouter.ts
import { Router } from "express";
import { openai } from "./aiClient";
import { getPuzzleFromDB } from "./Service/puzzleService";
import { evaluateAnswer } from "./Service/evaluationService";
import { recordSuccessfulAnswer } from "./Service/gameSessionService";
import { getGameSession, getGameSessionCompletion } from "./gameSession";
import multer from "multer";
import fs from "fs";
import os from "os";

export const chatRouter = Router();

type EvaluateRequestBody = {
  puzzleId: string;
  userAnswer: string;
};

// POST /chat/evaluate
// Evaluates a user's answer against a puzzle (no session required)
chatRouter.post("/evaluate", async (req, res) => {
  const { puzzleId, userAnswer } = req.body as EvaluateRequestBody;

  if (!puzzleId || !userAnswer) {
    return res.status(400).json({ error: "Missing puzzleId or userAnswer" });
  }

  try {
    const puzzle = await getPuzzleFromDB(puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    const result = await evaluateAnswer(userAnswer, puzzle);
    if (!result) {
      return res.status(500).json({ error: "Evaluation failed" });
    }

    return res.json({ result });
  } catch (err) {
    console.error("Error in /chat/evaluate:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Configure Multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ".m4a");
  },
});

const upload = multer({ storage });

// POST /chat/transcribe
// Transcribes audio, evaluates the answer, and updates session progress
chatRouter.post("/transcribe", upload.single("audioFile"), async (req, res) => {
  const { sessionId } = req.query;
  const tempFilePath = req.file?.path;

  if (!tempFilePath) {
    return res.status(400).json({ success: false, error: "No audio file provided." });
  }

  // Validate sessionId
  if (typeof sessionId !== "string" || !sessionId) {
    return res.status(400).json({ success: false, error: "Missing sessionId query parameter." });
  }

  const session = getGameSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found." });
  }

  try {
    console.log(`File received. Temporary path: ${tempFilePath}`);

    // Transcribe audio with OpenAI Whisper
    const audioStream = fs.createReadStream(tempFilePath);
    const transcript = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioStream as any,
    });

    console.log("Transcription successful:", transcript.text);

    // Get the puzzle for evaluation
    const puzzle = await getPuzzleFromDB(session.puzzleId);
    if (!puzzle) {
      return res.status(404).json({ success: false, error: "Puzzle not found." });
    }

    // Evaluate the transcribed answer
    const evaluation = await evaluateAnswer(transcript.text, puzzle);

    // If answer is relevant ("yes"), record it and check which parts it solves
    if (evaluation === "yes") {
      await recordSuccessfulAnswer(sessionId, transcript.text);
    }

    // Get updated completion percentage
    const completion = await getGameSessionCompletion(sessionId);

    return res.json({
      success: true,
      transcript: transcript.text,
      evaluation: evaluation,
      completion: completion,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Transcription error:", errorMessage);

    return res.status(500).json({
      success: false,
      error: "Transcription failed due to server error.",
      details: errorMessage,
    });
  } finally {
    // Always cleanup the temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Cleaned up temporary file: ${tempFilePath}`);
    }
  }
});
