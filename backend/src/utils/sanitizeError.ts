export interface SanitizedError {
  message: string;
  statusCode: number;
  code: string;
  details?: unknown;
}

export function sanitizeError(error: any): SanitizedError {
  const statusCode =
    typeof error?.statusCode === "number"
      ? error.statusCode
      : typeof error?.status === "number"
        ? error.status
        : 500;

  return {
    message:
      typeof error?.message === "string" && error.message.trim()
        ? error.message
        : "Internal server error",
    statusCode,
    code:
      typeof error?.code === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(error.code)
        ? error.code
        : "INTERNAL_ERROR",
    ...(error?.details !== undefined && { details: error.details }),
  };
}
