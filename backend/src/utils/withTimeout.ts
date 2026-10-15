import { AppError } from "./appError.js";

export async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds = 30000,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new AppError("CyberSource request timed out", {
          statusCode: 504,
          code: "CYBERSOURCE_TIMEOUT",
        }),
      );
    }, milliseconds);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
