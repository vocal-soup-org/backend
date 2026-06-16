export const COIN_CONFIG = {
  baseCompletionCoins: 100,
  completionMultiplier: 100,
  perfectBonus: 25,
  timeBonus: 25,
  attemptPenalty: 10,
  minimumCoins: 0,
  budgetsByAttempt: [20, 15, 10, 8, 6],
  minimumBudget: 5,
  timeLimitSecondsByLevel: [
    { maxLevel: 1, seconds: 10 * 60 },
    { maxLevel: 3, seconds: 8 * 60 },
    { maxLevel: 5, seconds: 6 * 60 },
  ],
  defaultTimeLimitSeconds: 5 * 60,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getBudgetForAttempt(_level: number, attemptNumber: number): number {
  const index = Math.max(0, attemptNumber - 1);
  return COIN_CONFIG.budgetsByAttempt[index] ?? COIN_CONFIG.minimumBudget;
}

export function getTimeLimitForLevel(level: number): number {
  const configured = COIN_CONFIG.timeLimitSecondsByLevel.find((entry) => level <= entry.maxLevel);
  return configured?.seconds ?? COIN_CONFIG.defaultTimeLimitSeconds;
}

export function calculateCoins(
  level: number,
  attemptNumber: number,
  completion: number,
  questionsUsed: number,
  budget: number,
  elapsedSeconds: number,
  timeLimitSeconds: number
): number {
  const normalizedCompletion = clamp(completion, 0, 1);
  if (normalizedCompletion <= 0) {
    return 0;
  }

  const completionCoins = Math.round(COIN_CONFIG.completionMultiplier * normalizedCompletion);
  const levelBonus = Math.max(0, level - 1) * 5;
  const perfectBonus = normalizedCompletion === 1 ? COIN_CONFIG.perfectBonus : 0;
  const questionBonus = questionsUsed <= budget ? Math.max(0, budget - questionsUsed) * 2 : 0;
  const timeBonus = elapsedSeconds <= timeLimitSeconds ? COIN_CONFIG.timeBonus : 0;
  const attemptPenalty = Math.max(0, attemptNumber - 1) * COIN_CONFIG.attemptPenalty;

  return Math.max(
    COIN_CONFIG.minimumCoins,
    COIN_CONFIG.baseCompletionCoins + completionCoins + levelBonus + perfectBonus + questionBonus + timeBonus - attemptPenalty
  );
}
