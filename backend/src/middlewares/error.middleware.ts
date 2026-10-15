import type { ErrorRequestHandler } from "express";
import { sanitizeError } from "../utils/sanitizeError.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: any,
  _req,
  res,
  _next,
) => {
  const sanitizedError = sanitizeError(error);
  const statusCode =
    sanitizedError.statusCode >= 400 && sanitizedError.statusCode <= 599
      ? sanitizedError.statusCode
      : 500;

  console.error(
    `${res.locals.errorLogLabel || "Unhandled request error"}:`,
    JSON.stringify(sanitizedError, null, 2),
  );

  res.status(statusCode).json({
    success: false,
    message: res.locals.errorMessage || sanitizedError.message,
    error: sanitizedError,
  });
};
