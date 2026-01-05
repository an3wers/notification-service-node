import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/env.ts";

export const checkSecretKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.headers["ssy"] || req.headers["ssy"] !== config.secretKey) {
    return res.status(400).json({ error: "Invalid secret key" });
  }
  next();
};
