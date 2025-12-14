import type { NextFunction, Request, Response } from "express";
import type { AppError } from "../errors/app-error.ts";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err.stack);

  // Default error
  let status = err.status || 500;
  let message = err.message || "Internal Server Error";

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
      details: err.message,
    }),
  });
};
