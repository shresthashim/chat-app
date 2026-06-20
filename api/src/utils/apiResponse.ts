import type { Response } from "express";

/**
 * Standard success envelope so every endpoint returns the same shape:
 *   { success: true, data, message? }
 * Errors use the mirror shape via the error middleware.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string,
): Response {
  return res.status(statusCode).json({ success: true, message, data });
}
