import { describe, expect, it } from "vitest";
import {
  captureIdParamsSchema,
  capturePaymentSchema,
  paymentIdParamsSchema,
} from "../src/modules/payments/payments.schemas.js";

describe("capture request validation", () => {
  it("accepts a positive amount, ISO currency, and reference code", () => {
    expect(
      capturePaymentSchema.parse({
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-ORDER-001",
      }),
    ).toEqual({
      amount: "10.00",
      currency: "USD",
      referenceCode: "CAPTURE-ORDER-001",
    });
  });

  it.each([
    { amount: "0", currency: "USD", referenceCode: "REF-1" },
    { amount: "0.000", currency: "USD", referenceCode: "REF-1" },
    { amount: "-1.00", currency: "USD", referenceCode: "REF-1" },
    { amount: "1.2345", currency: "USD", referenceCode: "REF-1" },
    { amount: 10, currency: "USD", referenceCode: "REF-1" },
  ])("rejects an invalid amount: %j", (payload) => {
    expect(capturePaymentSchema.safeParse(payload).success).toBe(false);
  });

  it.each(["usd", "US", "ZZZ", "123"])(
    "rejects invalid currency %s",
    (currency) => {
      expect(
        capturePaymentSchema.safeParse({
          amount: "10.00",
          currency,
          referenceCode: "REF-1",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects empty reference codes and unsupported fields", () => {
    expect(
      capturePaymentSchema.safeParse({
        amount: "10.00",
        currency: "USD",
        referenceCode: " ",
      }).success,
    ).toBe(false);
    expect(
      capturePaymentSchema.safeParse({
        amount: "10.00",
        currency: "USD",
        referenceCode: "REF-1",
        capture: true,
      }).success,
    ).toBe(false);
  });
});

describe("capture route parameter validation", () => {
  it("rejects missing payment and capture IDs", () => {
    expect(paymentIdParamsSchema.safeParse({}).success).toBe(false);
    expect(paymentIdParamsSchema.safeParse({ paymentId: " " }).success).toBe(
      false,
    );
    expect(captureIdParamsSchema.safeParse({}).success).toBe(false);
  });
});
