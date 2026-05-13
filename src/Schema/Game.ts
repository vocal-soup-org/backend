export type GameStatus = 'available' | 'locked' | 'premium';

export interface Game {
  id: string;                   // Unique identifier (e.g. "g1")
  status: GameStatus;           // available = free, locked = not accessible, premium = paid
  level: number;                // Difficulty level
  genre: string;                // Game genre (e.g. "mystery", "logic")
  name?: string;                // Display name (nullable)
  shortIntro: string;           // Brief description shown in the game catalog
  puzzleId: string;             // Foreign key linking to a Puzzle
  experience: number;           // XP awarded on completion
}
