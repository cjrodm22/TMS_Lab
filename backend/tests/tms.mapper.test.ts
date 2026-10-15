import { describe, expect, it } from "vitest";
import {
  buildPatchInstrumentIdentifierRequest,
  buildPatchPaymentInstrumentRequest,
  mapInstrumentIdentifierResponse,
  sanitizeInstrumentIdentifierResponse,
  sanitizePaymentInstrumentListResponse,
  sanitizePaymentInstrumentResponse,
} from "../src/modules/tms/tms.mapper.js";

describe("TMS PATCH request mappers", () => {
  it("maps only Payment Instrument expiration and billing data", () => {
    const result = buildPatchPaymentInstrumentRequest({
      card: { expirationMonth: "12", expirationYear: "2031" },
      billTo: { firstName: "Test", country: "US" },
    });

    expect(result).toMatchObject({
      card: { expirationMonth: "12", expirationYear: "2031" },
      billTo: { firstName: "Test", country: "US" },
    });
    expect(Object.hasOwn(result, "id")).toBe(false);
    expect(result.card).not.toHaveProperty("number");
  });

  it("maps only Instrument Identifier expiration and address data", () => {
    const result = buildPatchInstrumentIdentifierRequest({
      card: { expirationYear: "2032" },
      billTo: { address2: "Unit B", postalCode: "94105" },
    });

    expect(result).toMatchObject({
      card: { expirationYear: "2032" },
      billTo: { address2: "Unit B", postalCode: "94105" },
    });
    expect(Object.hasOwn(result, "id")).toBe(false);
    expect(result.card).not.toHaveProperty("number");
    expect(result.card).not.toHaveProperty("securityCode");
  });
});

describe("TMS response sanitization", () => {
  it("masks PAN and drops security and unapproved response properties", () => {
    const result = sanitizeInstrumentIdentifierResponse({
      id: "ii-1",
      object: "instrumentIdentifier",
      state: "ACTIVE",
      card: {
        number: "4111111111111111",
        expirationMonth: "12",
        expirationYear: "2031",
        securityCode: "123",
      },
      issuer: {
        paymentAccountReference: "account-reference",
        secret: "drop-me",
      },
      privateData: "do-not-return",
    });

    expect(result.card.number).toBe("****1111");
    expect(JSON.stringify(result)).not.toContain("4111111111111111");
    expect(result.card).not.toHaveProperty("securityCode");
    expect(result.issuer).toEqual({
      paymentAccountReference: "account-reference",
    });
    expect(result).not.toHaveProperty("privateData");
  });

  it("allowlists Payment Instrument fields", () => {
    const result = sanitizePaymentInstrumentResponse({
      id: "pi-1",
      object: "paymentInstrument",
      state: "ACTIVE",
      instrumentIdentifier: { id: "ii-1", card: { number: "4111111111111111" } },
      card: { expirationMonth: "12", expirationYear: "2031", type: "001" },
      billTo: { firstName: "Test", country: "US", secret: "drop-me" },
      _embedded: { instrumentIdentifier: { card: { number: "4111111111111111" } } },
    });

    expect(result.instrumentIdentifier).toEqual({ id: "ii-1" });
    expect(result.billTo).not.toHaveProperty("secret");
    expect(JSON.stringify(result)).not.toContain("4111111111111111");
    expect(result).not.toHaveProperty("_embedded");
  });

  it("sanitizes every Payment Instrument in a list", () => {
    const result = sanitizePaymentInstrumentListResponse({
      offset: 0,
      limit: 20,
      count: 1,
      total: 1,
      _embedded: {
        paymentInstruments: [
          {
            id: "pi-1",
            card: { expirationMonth: "12", secret: "drop-me" },
          },
        ],
      },
    });

    expect(result.paymentInstruments).toHaveLength(1);
    expect(result.paymentInstruments[0].card).not.toHaveProperty("secret");
  });

  it("does not include raw SDK data when disabled for retrieval operations", () => {
    const result = mapInstrumentIdentifierResponse(
      { id: "ii-1", card: { number: "4111111111111111" } },
      { status: 200 },
      false,
    );

    expect(result).not.toHaveProperty("raw");
    expect(result.responseStatus).toBe(200);
  });
});
