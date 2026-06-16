import { supabaseAdmin } from "../supabaseAdmin";
import { UserProfile } from "../Schema/User";

interface CompletionRewardResult {
  completionRecorded: boolean;
  leveledUp: boolean;
  newLevel: number;
  xpAwarded: number;
}

function isDuplicateProgressError(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

/**
 * Returns the user's profile. Creates one at level 1 if it doesn't exist yet.
 */
// languageHint is only used when creating a brand-new profile — it is ignored on conflict
// so it never overwrites an explicitly saved language preference.
export async function getOrCreateUserProfile(userId: string, languageHint?: string): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .upsert({ user_id: userId, level: 1, language: languageHint ?? 'en' }, { onConflict: "user_id", ignoreDuplicates: true })
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

    return { userId: existing.user_id, level: existing.level, language: existing.language ?? 'en', experience: existing.experience ?? 0 };
  }

  return { userId: data.user_id, level: data.level, language: data.language ?? 'en', experience: data.experience ?? 0 };
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

  return { userId: data.user_id, level: data.level, language: data.language, experience: data.experience ?? 0 };
}

/**
 * Marks a game as completed for a user.
 * Returns true only when this call creates the user's first completion for the game.
 */
export async function markGameCompleted(
  userId: string,
  gameId: string
): Promise<boolean> {
  const { error: insertError } = await supabaseAdmin
    .from("user_game_progress")
    .insert({ user_id: userId, game_id: gameId, completed: true });

  if (!insertError) {
    return true;
  }

  if (!isDuplicateProgressError(insertError)) {
    console.error("Error marking game completed:", insertError);
    throw new Error(`userService: failed to mark game '${gameId}' completed for '${userId}'`);
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("user_game_progress")
    .select("completed")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .single();

  if (fetchError || !existing) {
    throw new Error(`userService: failed to fetch completion for game '${gameId}' and user '${userId}'`);
  }

  if (existing.completed) {
    return false;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("user_game_progress")
    .update({ completed: true })
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .eq("completed", false)
    .select("completed")
    .maybeSingle();

  if (updateError) {
    throw new Error(`userService: failed to complete existing progress for game '${gameId}' and user '${userId}'`);
  }

  return Boolean(updated);
}

/**
 * Checks if all games at the user's current level are completed.
 * If so, increments the user's level by 1.
 * Returns the updated profile and whether a level-up occurred.
 */
export async function checkAndLevelUp(
  userId: string
): Promise<{ profile: UserProfile; leveledUp: boolean }> {
  const profile = await getOrCreateUserProfile(userId);

  // Get all games at the user's current level
  const { data: gamesAtLevel, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("level", profile.level);

  if (gamesError || !gamesAtLevel) {
    throw new Error(`userService: failed to fetch games at level ${profile.level}`);
  }

  if (gamesAtLevel.length === 0) {
    return { profile, leveledUp: false };
  }

  const gameIds = gamesAtLevel.map((g) => g.id);

  // Check how many of those games the user has completed
  const { data: completedGames, error: progressError } = await supabaseAdmin
    .from("user_game_progress")
    .select("game_id")
    .eq("user_id", userId)
    .eq("completed", true)
    .in("game_id", gameIds);

  if (progressError) {
    throw new Error(`userService: failed to fetch progress for '${userId}'`);
  }

  const allDone = completedGames?.length === gamesAtLevel.length;
  if (!allDone) {
    return { profile, leveledUp: false };
  }

  // All games at current level done — level up
  const { data: updated, error: levelError } = await supabaseAdmin
    .from("user_profiles")
    .update({ level: profile.level + 1 })
    .eq("user_id", userId)
    .select()
    .single();

  if (levelError || !updated) {
    throw new Error(`userService: failed to level up user '${userId}'`);
  }

  const newProfile: UserProfile = { userId: updated.user_id, level: updated.level, language: updated.language ?? 'en', experience: updated.experience ?? 0 };
  return { profile: newProfile, leveledUp: true };
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

/**
 * Awards XP from a completed game to the user's profile.
 * Reads the game's `experience` value and increments the user's total.
 * Returns the amount of XP awarded.
 */
export async function awardExperience(userId: string, gameId: string): Promise<number> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("experience")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw new Error(`userService: failed to fetch experience for game '${gameId}'`);
  }

  const xpToAdd: number = game.experience ?? 0;
  if (xpToAdd === 0) return 0;

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from("user_profiles")
    .select("experience")
    .eq("user_id", userId)
    .single();

  if (fetchError || !profile) {
    throw new Error(`userService: failed to fetch profile for XP update '${userId}'`);
  }

  const { error: updateError } = await supabaseAdmin
    .from("user_profiles")
    .update({ experience: (profile.experience ?? 0) + xpToAdd })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`userService: failed to award XP to '${userId}'`);
  }

  return xpToAdd;
}

/**
 * Completes a game and grants rewards only when this is the user's first completion.
 */
export async function completeGameAndAwardRewards(
  userId: string,
  gameId: string
): Promise<CompletionRewardResult> {
  const completionRecorded = await markGameCompleted(userId, gameId);
  const profile = await getOrCreateUserProfile(userId);

  if (!completionRecorded) {
    return {
      completionRecorded: false,
      leveledUp: false,
      newLevel: profile.level,
      xpAwarded: 0,
    };
  }

  const xpAwarded = await awardExperience(userId, gameId);
  const result = await checkAndLevelUp(userId);

  return {
    completionRecorded: true,
    leveledUp: result.leveledUp,
    newLevel: result.profile.level,
    xpAwarded,
  };
}
