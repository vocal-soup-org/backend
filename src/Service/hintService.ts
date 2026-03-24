import { openai } from "../aiClient";
import { Puzzle } from "../Schema/Puzzle";

/**
 * Generates a dynamic hint based on the player's current progress.
 * Hints are more vague early on and more targeted as progress increases.
 */
export async function generateHint(
  puzzle: Puzzle,
  completedPartIndexes: number[]
): Promise<string | null> {
  const solvedParts = puzzle.parts.filter((_, i) => completedPartIndexes.includes(i));
  const unsolvedParts = puzzle.parts.filter((_, i) => !completedPartIndexes.includes(i));
  const progress = puzzle.parts.length > 0
    ? completedPartIndexes.length / puzzle.parts.length
    : 0;

  if (unsolvedParts.length === 0) {
    return "You've already discovered everything — you've solved the puzzle!";
  }

  const systemPrompt = `
You are a game host for a lateral thinking puzzle game (海龟汤).

The player is stuck and has requested a hint. Your job is to give ONE helpful nudge without giving away the answer.

Rules:
- NEVER reveal any solution part word-for-word.
- NEVER hint at something the player has already discovered.
- If progress is low (< 30%), be vague and directional (e.g. "think about the motivation").
- If progress is mid (30–70%), be more focused on a specific undiscovered element.
- If progress is high (> 70%), give a targeted nudge toward what remains.
- Keep the hint to 1–2 sentences.
- Respond with plain text only — no JSON, no formatting.
`;

  const userPrompt = `
Puzzle scenario shown to player (汤面):
${puzzle.content}

Player progress: ${Math.round(progress * 100)}%

Already discovered by player (DO NOT hint at these):
${solvedParts.length > 0 ? solvedParts.map(p => `- ${p}`).join("\n") : "Nothing yet."}

Still undiscovered (use these as internal guidance ONLY — do NOT repeat verbatim):
${unsolvedParts.map(p => `- ${p}`).join("\n")}

Generate one hint for the player.
`;

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    return response.output_text.trim();
  } catch (err) {
    console.error("Error in generateHint:", err);
    return null;
  }
}
