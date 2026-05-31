import { Game } from "../Schema/Game";
import { supabaseAdmin } from "../supabaseAdmin";

function formatGame(data: any): Game {
  return {
    id: data.id,
    status: data.status,
    level: data.level,
    genre: data.genre,
    name: data.name ?? undefined,
    shortIntro: data.short_intro,
    puzzleId: data.puzzle_id,
  };
}

export async function getGameById(gameId: string, language?: string): Promise<Game> {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error) {
    console.error("Error fetching game:", error);
    throw new Error(`gameService: game '${gameId}' not found`);
  }

  if (language && language !== 'en') {
    const { data: t } = await supabaseAdmin
      .from("game_translations")
      .select("genre, short_intro")
      .eq("game_id", gameId)
      .eq("language", language)
      .single();
    return applyTranslation(formatGame(data), t, language);
  }

  return formatGame(data);
}

export async function getAllGames(language?: string): Promise<Game[]> {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .order("level", { ascending: true });

  if (error) {
    console.error("Error fetching games:", error);
    throw new Error("gameService: failed to fetch games");
  }

  if (!language || language === 'en') {
    return data.map(formatGame);
  }

  const { data: translations } = await supabaseAdmin
    .from("game_translations")
    .select("game_id, genre, short_intro")
    .eq("language", language)
    .in("game_id", data.map((g: any) => g.id));

  const byGameId = new Map((translations ?? []).map((t: any) => [t.game_id, t]));

  return data.map((g: any) => applyTranslation(formatGame(g), byGameId.get(g.id), language));
}

function applyTranslation(game: Game, t: any, language: string): Game {
  if (!t) return game;
  if (language === 'zh') {
    return {
      ...game,
      genreZh: t.genre ?? undefined,
      shortIntroZh: t.short_intro ?? undefined,
    };
  }
  return game;
}

export async function updateGame(gameId: string, fields: Partial<Game>): Promise<Game> {
  const updates: Record<string, any> = {};
  if (fields.status !== undefined)     updates.status      = fields.status;
  if (fields.level !== undefined)      updates.level       = fields.level;
  if (fields.genre !== undefined)      updates.genre       = fields.genre;
  if (fields.name !== undefined)       updates.name        = fields.name;
  if (fields.shortIntro !== undefined) updates.short_intro = fields.shortIntro;

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
        name: game.name,
        short_intro: game.shortIntro,
        puzzle_id: game.puzzleId,
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
