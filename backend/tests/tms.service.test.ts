import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  instrumentApi: {
    getInstrumentIdentifier: vi.fn(),
    getInstrumentIdentifierPaymentInstrumentsList: vi.fn(),
    patchInstrumentIdentifier: vi.fn(),
    postInstrumentIdentifier: vi.fn(),
  },
  paymentApi: {
    getPaymentInstrument: vi.fn(),
    patchPaymentInstrument: vi.fn(),
    postPaymentInstrument: vi.fn(),
  },
  instrumentConstructor: vi.fn(),
  paymentConstructor: vi.fn(),
}));

vi.mock("../src/cybs/cybsClient.js", () => {
  class EmptyRequest {}

  return {
    getCybsConfigObject: () => ({ authenticationType: "jwt" }),
    cybersourceRestClient: {
      InstrumentIdentifierApi: vi.fn(function () {
        sdkMocks.instrumentConstructor();
        return sdkMocks.instrumentApi;
      }),
      PaymentInstrumentApi: vi.fn(function () {
        sdkMocks.paymentConstructor();
        return sdkMocks.paymentApi;
      }),
      PostInstrumentIdentifierRequest: EmptyRequest,
      PostPaymentInstrumentRequest: EmptyRequest,
      PatchInstrumentIdentifierRequest: EmptyRequest,
      PatchPaymentInstrumentRequest: EmptyRequest,
    },
  };
});

import {
  getInstrumentIdentifier,
  getPaymentInstrument,
  listPaymentInstrumentsForInstrumentIdentifier,
  updatePaymentInstrument,
} from "../src/modules/tms/tms.service.js";

describe("TMS service SDK coordination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing token ID before constructing an SDK API client", async () => {
    await expect(getInstrumentIdentifier(" ")).rejects.toMatchObject({
      statusCode: 400,
      code: "MISSING_TOKEN_ID",
    });
    expect(sdkMocks.instrumentConstructor).not.toHaveBeenCalled();
  });

  it("uses the installed SDK GET signatures", async () => {
    sdkMocks.instrumentApi.getInstrumentIdentifier.mockImplementation(
      (_id, _opts, callback) =>
        callback(null, { id: "ii-1", card: { number: "4111111111111111" } }, { status: 200 }),
    );
    sdkMocks.instrumentApi.getInstrumentIdentifierPaymentInstrumentsList.mockImplementation(
      (_id, _opts, callback) =>
        callback(null, { count: 0, total: 0, _embedded: { paymentInstruments: [] } }, { status: 200 }),
    );
    sdkMocks.paymentApi.getPaymentInstrument.mockImplementation(
      (_id, _opts, callback) =>
        callback(null, { id: "pi-1" }, { status: 200 }),
    );

    await getInstrumentIdentifier("ii-1");
    await listPaymentInstrumentsForInstrumentIdentifier("ii-1");
    await getPaymentInstrument("pi-1");

    expect(sdkMocks.instrumentApi.getInstrumentIdentifier).toHaveBeenCalledWith(
      "ii-1",
      {},
      expect.any(Function),
    );
    expect(
      sdkMocks.instrumentApi.getInstrumentIdentifierPaymentInstrumentsList,
    ).toHaveBeenCalledWith("ii-1", {}, expect.any(Function));
    expect(sdkMocks.paymentApi.getPaymentInstrument).toHaveBeenCalledWith(
      "pi-1",
      {},
      expect.any(Function),
    );
  });

  it("uses the installed SDK PATCH signature and preserves the route token ID", async () => {
    sdkMocks.paymentApi.patchPaymentInstrument.mockImplementation(
      (_id, _request, _opts, callback) =>
        callback(null, { id: "pi-1" }, { status: 200 }),
    );

    await updatePaymentInstrument("pi-1", {
      card: { expirationMonth: "12", expirationYear: "2031" },
    });

    expect(sdkMocks.paymentApi.patchPaymentInstrument).toHaveBeenCalledWith(
      "pi-1",
      expect.objectContaining({
        card: { expirationMonth: "12", expirationYear: "2031" },
      }),
      {},
      expect.any(Function),
    );
  });

  it("normalizes SDK errors without exposing their raw body", async () => {
    sdkMocks.paymentApi.getPaymentInstrument.mockImplementation(
      (_id, _opts, callback) =>
        callback(
          {
            status: 404,
            response: {
              body: { reason: "TOKEN_NOT_FOUND", pan: "4111111111111111" },
            },
          },
          undefined,
          undefined,
        ),
    );

    await expect(getPaymentInstrument("pi-missing")).rejects.toMatchObject({
      message: "CyberSource request failed",
      statusCode: 404,
      code: "TOKEN_NOT_FOUND",
    });
  });
});
