import { describe, expect, it } from "vitest";
import {
  AppError,
  normalizeCybersourceError,
} from "../src/utils/appError.js";
import { sanitizeError } from "../src/utils/sanitizeError.js";
import { withTimeout } from "../src/utils/withTimeout.js";

describe("CyberSource error normalization", () => {
  it("preserves safe status and reason without exposing the raw SDK body", () => {
    const normalized = normalizeCybersourceError({
      status: 404,
      message: "raw upstream error",
      response: {
        body: {
          reason: "TOKEN_NOT_FOUND",
          card: { number: "4111111111111111" },
        },
        text: "raw response text",
      },
    });
    const sanitized = sanitizeError(normalized);

    expect(sanitized).toEqual({
      message: "CyberSource request failed",
      statusCode: 404,
      code: "TOKEN_NOT_FOUND",
    });
    expect(JSON.stringify(sanitized)).not.toContain("4111111111111111");
    expect(JSON.stringify(sanitized)).not.toContain("raw response text");
  });

  it("maps upstream server failures to a safe gateway error", () => {
    const normalized = normalizeCybersourceError({ status: 500 });

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.statusCode).toBe(502);
    expect(normalized.code).toBe("CYBERSOURCE_ERROR");
  });

  it("normalizes request timeouts consistently", async () => {
    await expect(
      withTimeout(new Promise<never>(() => undefined), 1),
    ).rejects.toMatchObject({
      message: "CyberSource request timed out",
      statusCode: 504,
      code: "CYBERSOURCE_TIMEOUT",
    });
  });
});
