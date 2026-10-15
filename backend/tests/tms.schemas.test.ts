import { describe, expect, it } from "vitest";
import {
  patchInstrumentIdentifierSchema,
  patchPaymentInstrumentSchema,
  tokenIdParamsSchema,
} from "../src/modules/tms/tms.schemas.js";

describe("TMS route parameter validation", () => {
  it("accepts a non-empty token ID", () => {
    expect(tokenIdParamsSchema.parse({ id: "F39763E8-CFDF_2354" })).toEqual({
      id: "F39763E8-CFDF_2354",
    });
  });

  it.each([{ id: "" }, { id: "   " }, { id: "token/id" }, {}])(
    "rejects a missing or invalid token ID: %j",
    (params) => {
      expect(tokenIdParamsSchema.safeParse(params).success).toBe(false);
    },
  );
});

describe("Payment Instrument PATCH validation", () => {
  it("accepts expiration and documented billing fields", () => {
    const result = patchPaymentInstrumentSchema.parse({
      card: { expirationMonth: "12", expirationYear: "2031" },
      billTo: {
        firstName: "Test",
        lastName: "Customer",
        company: "Example",
        address1: "1 Test Street",
        address2: "Unit B",
        locality: "Test City",
        administrativeArea: "CA",
        postalCode: "94105",
        country: "US",
        email: "test@example.com",
        phoneNumber: "+1 555 010 0000",
      },
    });

    expect(result.card?.expirationMonth).toBe("12");
  });

  it.each([
    {},
    { card: {} },
    { billTo: {} },
    { card: { expirationMonth: "13" } },
    { card: { expirationMonth: "1" } },
    { card: { expirationYear: "31" } },
    { card: { expirationYear: "20A1" } },
    { card: { number: "4111111111111111" } },
    { id: "replacement-token" },
    { billTo: { unsupported: "value" } },
  ])("rejects an empty, invalid, or unsupported payload: %j", (payload) => {
    expect(patchPaymentInstrumentSchema.safeParse(payload).success).toBe(false);
  });
});

describe("Instrument Identifier PATCH validation", () => {
  it("accepts only documented safe card and address fields", () => {
    expect(
      patchInstrumentIdentifierSchema.safeParse({
        card: { expirationMonth: "09" },
        billTo: { address1: "1 Test Street", country: "US" },
      }).success,
    ).toBe(true);
  });

  it.each([
    {},
    { card: { number: "4111111111111111" } },
    { card: { securityCode: "123" } },
    { billTo: { firstName: "Not supported for this resource" } },
    { bankAccount: { number: "123456789" } },
    { state: "CLOSED" },
  ])("rejects sensitive or unsupported fields: %j", (payload) => {
    expect(patchInstrumentIdentifierSchema.safeParse(payload).success).toBe(
      false,
    );
  });
});
