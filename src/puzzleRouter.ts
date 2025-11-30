
import { Router } from "express";
import { Puzzle } from "./Schema/Puzzle";
import { supabaseAdmin } from "./supabaseAdmin";

export const puzzleRouter = Router();


puzzleRouter.post(
  "/add",
  async (req, res) => {
    const { id, title, content, fullAnswer, parts, hint } =
      req.body as Puzzle;

    const { data, error } = await supabaseAdmin
    .from('puzzles')
    .insert([
      {
        id: id,
        title: title,
        content: content,
        full_answer: fullAnswer, // Mapping JS -> DB
        parts: parts,            // JS Array passes directly
        hint: hint
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
