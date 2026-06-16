import { Router } from "express";
import { getGameSession, getQuestionsRemaining } from "./gameSession";
import { updateSession } from "./Service/gameSessionService";
import { InsufficientCoinsError, resetGameAttempts, spendCoins } from "./Service/userService";

export const coinRouter = Router();

const COIN_SPEND_COSTS = {
  extra_questions: 10,
  reset_attempt: 25,
  unlock_case: 50,
  cosmetic: 15,
} as const;

const EXTRA_QUESTIONS_AMOUNT = 5;

type SpendAction = keyof typeof COIN_SPEND_COSTS;

function isSpendAction(action: string): action is SpendAction {
  return action in COIN_SPEND_COSTS;
}

coinRouter.post("/spend", async (req, res) => {
  const { userId, action, targetId } = req.body as {
    userId?: string;
    action?: string;
    targetId?: string;
  };

  if (!userId || !action || !isSpendAction(action)) {
    return res.status(400).json({ error: "Missing or invalid userId/action" });
  }

  try {
    if (action === "extra_questions") {
      if (!targetId) {
        return res.status(400).json({ error: "Missing targetId sessionId" });
      }
      if (!getGameSession(targetId)) {
        return res.status(404).json({ error: "Session not found" });
      }

      const newBalance = await spendCoins(userId, COIN_SPEND_COSTS[action]);
      const session = updateSession(targetId, (current) => {
        current.questionBudget += EXTRA_QUESTIONS_AMOUNT;
      });

      return res.json({
        success: true,
        newBalance,
        questionBudget: session.questionBudget,
        questionsRemaining: getQuestionsRemaining(session),
      });
    }

    if (action === "reset_attempt") {
      if (!targetId) {
        return res.status(400).json({ error: "Missing targetId gameId" });
      }

      const newBalance = await spendCoins(userId, COIN_SPEND_COSTS[action]);
      await resetGameAttempts(userId, targetId);
      return res.json({ success: true, newBalance });
    }

    const newBalance = await spendCoins(userId, COIN_SPEND_COSTS[action]);
    return res.json({ success: true, newBalance });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return res.status(402).json({ success: false, error: "Insufficient coins" });
    }

    console.error("Error in POST /v1/coins/spend:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
