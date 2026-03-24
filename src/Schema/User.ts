export interface UserProfile {
  userId: string;
  level: number;   // Current level — unlocks games at this level and below
}

export interface UserGameProgress {
  userId: string;
  gameId: string;
  completed: boolean;
}
