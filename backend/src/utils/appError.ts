export interface AppErrorOptions {
  statusCode: number;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}

function readStatusCode(error: any): number | undefined {
  const value = error?.statusCode ?? error?.status ?? error?.response?.status;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function readCybersourceCode(error: any): string | undefined {
  const value =
    error?.response?.body?.reason ??
    error?.response?.body?.code ??
    error?.body?.reason ??
    error?.code;

  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value)
    ? value
    : undefined;
}

export function normalizeCybersourceError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const upstreamStatus = readStatusCode(error);
  const statusCode =
    upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500
      ? upstreamStatus
      : 502;

  return new AppError("CyberSource request failed", {
    statusCode,
    code: readCybersourceCode(error) ?? "CYBERSOURCE_ERROR",
  });
}
