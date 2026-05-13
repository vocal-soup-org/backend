import { supabaseAdmin } from "../supabaseAdmin";
import { UserProfile } from "../Schema/User";

// Total XP required to reach each level (index = target level)
const LEVEL_THRESHOLDS: Record<number, number> = {
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
};

function mapProfile(data: any): UserProfile {
  return {
    userId: data.user_id,
    level: data.level,
    experience: data.experience ?? 0,
    language: data.language ?? 'en',
  };
}

// languageHint is only used when creating a brand-new profile — it is ignored on conflict
// so it never overwrites an explicitly saved language preference.
export async function getOrCreateUserProfile(userId: string, languageHint?: string): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .upsert({ user_id: userId, level: 1, experience: 0, language: languageHint ?? 'en' }, { onConflict: "user_id", ignoreDuplicates: true })
    .select()
    .single();

  if (error) {
    // upsert with ignoreDuplicates won't return data on conflict — fetch manually
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`userService: failed to get profile for '${userId}'`);
    }

    return mapProfile(existing);
  }

  return mapProfile(data);
}

export async function updateUserLanguage(userId: string, language: string): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .update({ language })
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`userService: failed to update language for '${userId}'`);
  }

  return mapProfile(data);
}

/**
 * Marks a game as completed for a user. Does nothing if already marked.
 */
export async function markGameCompleted(
  userId: string,
  gameId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_game_progress")
    .upsert(
      { user_id: userId, game_id: gameId, completed: true },
      { onConflict: "user_id,game_id" }
    );

  if (error) {
    console.error("Error marking game completed:", error);
    throw new Error(`userService: failed to mark game '${gameId}' completed for '${userId}'`);
  }
}

/**
 * Awards XP for completing a game and levels up the user if they hit the next threshold.
 * XP is only awarded once — if the game was already completed, xpGained will be 0.
 * Returns the updated profile, whether a level-up occurred, and how much XP was gained.
 */
export async function awardXpAndLevelUp(
  userId: string,
  gameId: string
): Promise<{ profile: UserProfile; leveledUp: boolean; xpGained: number }> {
  // Check if the user already completed this game (no double XP)
  const { data: existingProgress } = await supabaseAdmin
    .from("user_game_progress")
    .select("completed")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .single();

  if (existingProgress?.completed) {
    const profile = await getOrCreateUserProfile(userId);
    return { profile, leveledUp: false, xpGained: 0 };
  }

  // Look up how much XP this game awards
  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("experience")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw new Error(`userService: failed to fetch game '${gameId}'`);
  }

  const xpGained: number = game.experience ?? 0;
  const profile = await getOrCreateUserProfile(userId);
  const newXp = profile.experience + xpGained;

  // Check if new total XP crosses one or more level thresholds
  let newLevel = profile.level;
  while (LEVEL_THRESHOLDS[newLevel + 1] !== undefined && newXp >= LEVEL_THRESHOLDS[newLevel + 1]) {
    newLevel++;
  }

  const leveledUp = newLevel > profile.level;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("user_profiles")
    .update({ experience: newXp, level: newLevel })
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(`userService: failed to update XP for '${userId}'`);
  }

  return { profile: mapProfile(updated), leveledUp, xpGained };
}

/**
 * Returns the games catalog with per-user lock status and completion.
 * Games above the user's level are marked as locked.
 */
export async function getGamesForUser(userId: string): Promise<
  Array<{ gameId: string; locked: boolean; completed: boolean }>
> {
  const profile = await getOrCreateUserProfile(userId);

  const { data: allGames, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, level")
    .order("level", { ascending: true });

  if (gamesError || !allGames) {
    throw new Error("userService: failed to fetch games");
  }

  const { data: completedGames } = await supabaseAdmin
    .from("user_game_progress")
    .select("game_id")
    .eq("user_id", userId)
    .eq("completed", true);

  const completedSet = new Set((completedGames ?? []).map((g) => g.game_id));

  return allGames.map((g) => ({
    gameId: g.id,
    locked: g.level > profile.level,
    completed: completedSet.has(g.id),
  }));
}
