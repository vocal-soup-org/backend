import { Router } from "express";
import { getOrCreateUserProfile, getGamesForUser, updateUserLanguage } from "./Service/userService";

export const userRouter = Router();

// GET /v1/users/:userId
// Returns the user's profile (level)
userRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const profile = await getOrCreateUserProfile(userId);
    return res.json(profile);
  } catch (err) {
    console.error("Error in GET /v1/users/:userId:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /v1/users/:userId/language
// Updates the user's preferred language
userRouter.patch("/:userId/language", async (req, res) => {
  const { userId } = req.params;
  const { language } = req.body as { language?: string };

  if (!language) {
    return res.status(400).json({ error: "Missing language" });
  }

  try {
    const profile = await updateUserLanguage(userId, language);
    return res.json(profile);
  } catch (err) {
    console.error("Error in PATCH /v1/users/:userId/language:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/users/:userId/games
// Returns the full game catalog with per-user lock and completion status
userRouter.get("/:userId/games", async (req, res) => {
  const { userId } = req.params;
  try {
    const games = await getGamesForUser(userId);
    return res.json(games);
  } catch (err) {
    console.error("Error in GET /v1/users/:userId/games:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
