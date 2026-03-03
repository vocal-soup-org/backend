
import { Router } from "express";
import { Puzzle } from "./Schema/Puzzle";
import { supabaseAdmin } from "./supabaseAdmin";
import { getPuzzleFromDB } from "./Service/puzzleService";

export const puzzleRouter = Router();

// GET /v1/puzzles/:id
// Returns full puzzle content for the challenge screen
puzzleRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const puzzle = await getPuzzleFromDB(id);
    return res.json(puzzle);
  } catch (err) {
    console.error("Error in GET /v1/puzzles/:id:", err);
    return res.status(404).json({ error: "Puzzle not found" });
  }
});


puzzleRouter.post(
  "/add",
  async (req, res) => {
    const { id, title, content, fullAnswer, parts, hint, backgroundPicture } =
      req.body as Puzzle;

    const { data, error } = await supabaseAdmin
    .from('puzzles')
    .insert([
      {
        id: id,
        title: title,
        content: content,
        full_answer: fullAnswer,              // Mapping JS -> DB
        parts: parts,                         // JS Array passes directly
        hint: hint,
        background_picture: backgroundPicture // Optional, may be undefined
      }
    ])
    .select(); // Returns the inserted row

  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Success:', data);
  }
  return res.status(200).json({ data, error });
});
