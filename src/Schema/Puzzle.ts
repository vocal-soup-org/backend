export interface PuzzleTranslation {
  puzzle_id:    string;
  language:     string;
  title?:       string;
  content?:     string;
  full_answer?: string;
  hint?:        string;
  parts?:       string[];
}

export interface Puzzle {
  id:                   string;
  title:                string;
  content:              string;
  fullAnswer:           string;
  parts:                string[];
  hint?:                string;
  puzzle_translations?: PuzzleTranslation[];
}
