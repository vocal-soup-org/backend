// src/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "./supabaseAdmin";

export interface AuthedRequest extends Request {
  user?: any; // you can type this better later
}

export async function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    console.error("Supabase auth error:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = data.user;
  next();
}
