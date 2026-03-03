import { Game } from "../Schema/Game";
import { supabaseAdmin } from "../supabaseAdmin";

function formatGame(data: any): Game {
  return {
    id: data.id,
    status: data.status,
    level: data.level,
    genre: data.genre,
    backgroundPicture: data.background_picture ?? undefined,
    shortIntro: data.short_intro,
    puzzleId: data.puzzle_id,
    progress: data.progress ?? 0,
  };
}

export async function getGameById(gameId: string): Promise<Game> {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error) {
    console.error("Error fetching game:", error);
    throw new Error(`gameService: game '${gameId}' not found`);
  }

  return formatGame(data);
}

export async function getAllGames(): Promise<Game[]> {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .order("level", { ascending: true });

  if (error) {
    console.error("Error fetching games:", error);
    throw new Error("gameService: failed to fetch games");
  }

  return data.map(formatGame);
}

export async function updateGame(gameId: string, fields: Partial<Game>): Promise<Game> {
  const updates: Record<string, any> = {};
  if (fields.status !== undefined)           updates.status             = fields.status;
  if (fields.level !== undefined)            updates.level              = fields.level;
  if (fields.genre !== undefined)            updates.genre              = fields.genre;
  if (fields.backgroundPicture !== undefined) updates.background_picture = fields.backgroundPicture;
  if (fields.shortIntro !== undefined)       updates.short_intro        = fields.shortIntro;
  if (fields.progress !== undefined)         updates.progress           = fields.progress;

  const { data, error } = await supabaseAdmin
    .from("games")
    .update(updates)
    .eq("id", gameId)
    .select()
    .single();

  if (error) {
    console.error("Error updating game:", error);
    throw new Error(`gameService: failed to update game '${gameId}'`);
  }

  return formatGame(data);
}

export async function createGame(game: Game): Promise<Game> {
  const { data, error } = await supabaseAdmin
    .from("games")
    .insert([
      {
        id: game.id,
        status: game.status,
        level: game.level,
        genre: game.genre,
        background_picture: game.backgroundPicture,
        short_intro: game.shortIntro,
        puzzle_id: game.puzzleId,
        progress: game.progress ?? 0,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating game:", error);
    throw new Error("gameService: failed to create game");
  }

  return formatGame(data);
}
