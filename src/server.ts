// src/server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { requireUser, AuthedRequest } from "./authMiddleware";
import { chatRouter } from "./chatRouter";
import { gameRouter } from "./gameRouter";
import { puzzleRouter } from "./puzzleRouter";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Public route: sanity check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/me", requireUser, (req: AuthedRequest, res) => {
  const user = req.user;

  res.json({
    id: user.id,
    email: user.email,
    language: user.user_metadata?.language || "en", // default fallback
  });
});


app.use("/v1/chat", chatRouter);
app.use("/v1/games", gameRouter);
app.use("/v1/puzzles", puzzleRouter);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
