export interface UserProfile {
  userId: string;
  level: number;   // Current level — unlocks games at this level and below
  language: string;
  experience: number;
  coins: number;
}

export interface UserGameProgress {
  userId: string;
  gameId: string;
  completed: boolean;
  attemptsUsed: number;
  bestScore: number;
  bestCompletion: number;
}
