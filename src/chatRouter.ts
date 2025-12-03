// src/chatRoutes.ts
import { Router } from "express";
import { openai } from "./aiClient";
import { getPuzzleFromDB } from "./Service/puzzleService";
import { StoryService } from "./Service/storyService";
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os'; // Needed for os.tmpdir()
import { ChatService } from "./Service/chatService";

export const chatRouter = Router();
const chatService = ChatService.getInstance();

type EvaluateRequestBody = {
  puzzleId: string;
  puzzlePrompt: string;
  answerKey: string;
  userAnswer: string;
};

type ChatResult = "yes" | "no" | "not_sure";

type EvaluateResponseBody = {
  result: ChatResult;
};


chatRouter.post(
  "/evaluate",
  async (req, res) => {
    const { puzzleId, userAnswer } =
      req.body as EvaluateRequestBody;
     const puzzle = await getPuzzleFromDB(puzzleId);
    if (!puzzleId || !puzzle.title || !puzzle.fullAnswer || !userAnswer) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Prompt design: strict grader, JSON only
      const systemPrompt = `
现在我们要玩海龟汤，我会给你提供三个东西：
1. 汤面
2. 汤底
3. 玩家的猜测

Rules:
- Respond ONLY with a JSON object.
- JSON format:
  {
    "result": "yes" | "no" | "not_sure" | "not_related"
  }

`;

const userPrompt = `

汤面:
${puzzle.content}

汤底:
${puzzle.fullAnswer}

玩家的猜测:
${userAnswer}

Now grade the answer strictly following the JSON format.
`;

      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
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
        parsed.result !== "not_sure" &&
        parsed.result !== "not_related"
      ) {
        return res
          .status(500)
          .json({ error: "AI returned invalid result field" });
      }

      // TODO: send the user's answer to Completion AI to evaluate
      

      return res.json(parsed);
    } catch (err) {
      console.error("Error in /chat/evaluate:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// 💾 Configure Multer for File Storage
const storage = multer.diskStorage({
  // Use the system's temporary directory for uploads
  destination: (req, file, cb) => {
    // os.tmpdir() is a safe, temporary location
    cb(null, os.tmpdir()); 
  },
  // Set the filename and ensure the correct extension
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Assuming the client is sending .m4a files
    cb(null, file.fieldname + '-' + uniqueSuffix + '.m4a');
  },
});


const upload = multer({ storage: storage });

// --- Transcription Endpoint ---
// Use the custom MulterRequest type here
chatRouter.post('/transcribe', upload.single('audioFile'), async (req, res) => {
  const { puzzleID } = req.query;
  // 2. Initialize a string variable
  let puzzleIdString: string;
  puzzleIdString = "";
  if (typeof puzzleID === 'string') {
      // Case 1: The most common case, it's a single string value.
      puzzleIdString = puzzleID;
  }
  const tempFilePath = req.file?.path;
  
  if (!tempFilePath) {
    return res.status(400).json({ success: false, error: 'No audio file provided.' });
  }

  try {
    console.log(`File received. Temporary path: ${tempFilePath}`);
    
    // 1. Read the file stream
    // Using fs.createReadStream is efficient for large files
    const audioStream = fs.createReadStream(tempFilePath);

    // 2. Call the OpenAI API for transcription
    const transcript = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      // Since `file` accepts a ReadStream, we can pass it directly
      file: audioStream as any, // Cast to any to satisfy file type requirements for streams
    });

    console.log('Transcription successful.');
    const evaluation = await chatService.evaluateAnswer(transcript.text, puzzleIdString);
    res.json({
      success: true,
      evaluation: evaluation
    });
  } catch (error) {
    // Detailed error logging
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error('OpenAI Transcription Error:', errorMessage);
    
    res.status(500).json({ 
        success: false, 
        error: 'Transcription failed due to server error.', 
        details: errorMessage
    });

  } finally {
    // 4. Cleanup: ALWAYS remove the temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Cleaned up temporary file: ${tempFilePath}`);
    }
  }
});