// src/server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { requireUser, AuthedRequest } from "./authMiddleware";
import { getOrCreateUserProfile } from "./Service/userService";
import { chatRouter } from "./chatRouter";
import { gameRouter } from "./gameRouter";
import { puzzleRouter } from "./puzzleRouter";
import { userRouter } from "./userRouter";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "Assets")));

// Public route: sanity check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/me", requireUser, async (req: AuthedRequest, res) => {
  const user = req.user;

  try {
    // Bootstrap language from Auth metadata on first profile creation.
    // ignoreDuplicates means this hint is ignored if the profile already exists.
    const profile = await getOrCreateUserProfile(user.id, user.user_metadata?.language);
    return res.json({
      id: user.id,
      email: user.email,
      language: profile.language,
    });
  } catch (err) {
    console.error("Error in GET /me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


app.use("/v1/chat", chatRouter);
app.use("/v1/games", gameRouter);
app.use("/v1/puzzles", puzzleRouter);
app.use("/v1/users", userRouter);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
