import { z } from "zod";

const supportedCurrencies = new Set(
  (
    Intl as typeof Intl & {
      supportedValuesOf(key: "currency"): string[];
    }
  ).supportedValuesOf("currency"),
);

const transactionIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(128, `${label} is too long`)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      `${label} may contain only letters, numbers, underscores, and hyphens`,
    );

export const paymentIdParamsSchema = z
  .object({
    paymentId: transactionIdSchema("paymentId"),
  })
  .strict();

export const captureIdParamsSchema = z
  .object({
    captureId: transactionIdSchema("captureId"),
  })
  .strict();

export const capturePaymentSchema = z
  .object({
    amount: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/,
        "amount must be a positive decimal string with up to three decimal places",
      )
      .refine((value) => Number(value) > 0, {
        message: "amount must be greater than zero",
      }),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "currency must be a three-letter uppercase code")
      .refine((value) => supportedCurrencies.has(value), {
        message: "currency must be a valid ISO 4217 code",
      }),
    referenceCode: z.string().trim().min(1, "referenceCode is required"),
  })
  .strict();
