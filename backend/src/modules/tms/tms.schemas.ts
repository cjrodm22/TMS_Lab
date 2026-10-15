import { z } from "zod";

const nonBlank = (maximum: number) => z.string().trim().min(1).max(maximum);

export const tokenIdParamsSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "Token ID is required")
      .max(128, "Token ID is too long")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Token ID may contain only letters, numbers, underscores, and hyphens",
      ),
  })
  .strict();

export const expirationMonthSchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])$/, "Expiration month must use MM (01-12)");

export const expirationYearSchema = z
  .string()
  .regex(/^\d{4}$/, "Expiration year must use YYYY");

const expirationPatchSchema = z
  .object({
    expirationMonth: expirationMonthSchema.optional(),
    expirationYear: expirationYearSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "card must contain at least one expiration field",
  });

export const paymentInstrumentBillToPatchSchema = z
  .object({
    firstName: nonBlank(60).optional(),
    lastName: nonBlank(60).optional(),
    company: nonBlank(100).optional(),
    address1: nonBlank(200).optional(),
    address2: nonBlank(200).optional(),
    locality: nonBlank(100).optional(),
    administrativeArea: nonBlank(100).optional(),
    postalCode: nonBlank(20).optional(),
    country: z.string().regex(/^[A-Z]{2}$/, "country must be a two-letter ISO code").optional(),
    email: z.string().email().max(254).optional(),
    phoneNumber: z
      .string()
      .regex(/^[0-9+(). -]{1,32}$/, "phoneNumber has an invalid format")
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "billTo must contain at least one supported field",
  });

export const instrumentIdentifierBillToPatchSchema = z
  .object({
    address1: nonBlank(200).optional(),
    address2: nonBlank(200).optional(),
    locality: nonBlank(100).optional(),
    administrativeArea: nonBlank(100).optional(),
    postalCode: nonBlank(20).optional(),
    country: z.string().regex(/^[A-Z]{2}$/, "country must be a two-letter ISO code").optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "billTo must contain at least one supported field",
  });

export const patchPaymentInstrumentSchema = z
  .object({
    card: expirationPatchSchema.optional(),
    billTo: paymentInstrumentBillToPatchSchema.optional(),
  })
  .strict()
  .refine((value) => value.card !== undefined || value.billTo !== undefined, {
    message: "PATCH payload must contain card or billTo",
  });

export const patchInstrumentIdentifierSchema = z
  .object({
    card: expirationPatchSchema.optional(),
    billTo: instrumentIdentifierBillToPatchSchema.optional(),
  })
  .strict()
  .refine((value) => value.card !== undefined || value.billTo !== undefined, {
    message: "PATCH payload must contain card or billTo",
  });
