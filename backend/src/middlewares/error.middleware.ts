import type { ErrorRequestHandler } from "express";
import { sanitizeError } from "../utils/sanitizeError.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: any,
  _req,
  res,
  _next,
) => {
  if (!res.locals.errorMessage || !res.locals.errorLogLabel) {
    _next(error);
    return;
  }

  const sanitizedError = sanitizeError(error);
  const statusCode = error?.statusCode || error?.status || 500;

  console.error(
    `${res.locals.errorLogLabel || "Unhandled request error"}:`,
    JSON.stringify(sanitizedError, null, 2),
  );

  res.status(statusCode).json({
    success: false,
    message: res.locals.errorMessage || "Internal server error",
    error: sanitizedError,
  });
};
