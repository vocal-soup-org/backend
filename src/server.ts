// src/server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { requireUser, AuthedRequest } from "./authMiddleware";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Public route: sanity check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Protected route: needs valid Supabase token
app.get("/me", requireUser, (req: AuthedRequest, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    email: user.email,
    // You can expose more Supabase user metadata if you want:
    // app_metadata: user.app_metadata,
    // user_metadata: user.user_metadata,
  });
});

// Later: add your game routes here, all protected by requireUser

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
