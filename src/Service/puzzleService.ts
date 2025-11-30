import { Puzzle } from "../Schema/Puzzle";
import { supabaseAdmin } from "../supabaseAdmin";


export async function getPuzzleFromDB(puzzleId: string): Promise<Puzzle> {
  const { data, error } = await supabaseAdmin
    .from('puzzles')
    .select('*')
    .eq('id', puzzleId)
    .single(); // .single() is useful when you expect exactly one result

  if (error) {
    console.error('Error fetching:', error);
    throw Error;
  }

  // If you strictly need your specific Interface structure back:
  const formattedPuzzle = {
    id: data.id,
    title: data.title,
    content: data.content,
    fullAnswer: data.full_answer, // Map back to camelCase
    parts: data.parts,            // Comes back as a JS array automatically
    hint: data.hint
  };

  console.log('Loaded Puzzle:', formattedPuzzle);
  return formattedPuzzle;
}