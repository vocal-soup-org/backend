export type GameStatus = 'available' | 'locked' | 'premium';

export interface Game {
  id: string;                   // Unique identifier (e.g. "g1")
  status: GameStatus;           // available = free, locked = not accessible, premium = paid
  level: number;                // Difficulty level
  genre: string;                // Game genre (e.g. "mystery", "logic")
  genreZh?: string;             // Localized genre (Chinese)
  name?: string;                // Display name (nullable)
  shortIntro: string;           // Brief description shown in the game catalog
  shortIntroZh?: string;        // Localized short intro (Chinese)
  puzzleId: string;             // Foreign key linking to a Puzzle
}
