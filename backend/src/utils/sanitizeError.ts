export interface SanitizedError {
  message?: string;
  statusCode?: number;
  responseBody?: unknown;
  responseText?: unknown;
}

export function sanitizeError(error: any): SanitizedError {
  return {
    message: error?.message,
    statusCode: error?.statusCode || error?.status,
    responseBody: error?.response?.body,
    responseText: error?.response?.text,
  };
}
