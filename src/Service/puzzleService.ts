import { Puzzle } from "../Schema/Puzzle";
import { supabaseAdmin } from "../supabaseAdmin";


export async function getPuzzleFromDB(puzzleId: string, language: string = 'en'): Promise<Puzzle> {
  const { data, error } = await supabaseAdmin
    .from('puzzles')
    .select('*, puzzle_translations(*)')
    .eq('id', puzzleId)
    .single();

  if (error || !data) {
    console.error('Error fetching:', error);
    throw error;
  }

  const parts = typeof data.parts === 'string'
    ? JSON.parse(data.parts)
    : data.parts ?? [];

  if (language === 'en') {
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      fullAnswer: data.full_answer,
      parts,
      hint: data.hint,
    };
  }

  const translation = (data.puzzle_translations ?? [])
    .find((t: any) => t.language === language);

  return {
    id: data.id,
    title:       translation?.title       || data.title,
    content:     translation?.content     || data.content,
    fullAnswer:  translation?.full_answer || data.full_answer,
    parts,
    hint:        translation?.hint        || data.hint,
  };
}