export interface Puzzle {
  id: string;              // Unique identifier (e.g. "p1")
  title: string;           // Display name (e.g. "The Two Guards")
  content: string;         // The puzzle description shown to the player
  fullAnswer: string;      // Full correct explanation (for give-up or reveal)
  parts: string[];         // Array of key solution parts for scoring (AI uses these)
  hint: string;            // Optional hint shown to the user
}
