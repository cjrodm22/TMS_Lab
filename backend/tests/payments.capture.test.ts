import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  capturePayment: vi.fn(),
  createPayment: vi.fn(),
  getTransaction: vi.fn(),
  captureConstructor: vi.fn(),
  paymentsConstructor: vi.fn(),
  transactionDetailsConstructor: vi.fn(),
}));

vi.mock("../src/cybs/cybsClient.js", () => {
  class EmptyRequest {}

  return {
    getCybsConfigObject: () => ({ authenticationType: "jwt" }),
    cybersourceRestClient: {
      CaptureApi: function () {
        sdkMocks.captureConstructor();
        return { capturePayment: sdkMocks.capturePayment };
      },
      PaymentsApi: function () {
        sdkMocks.paymentsConstructor();
        return { createPayment: sdkMocks.createPayment };
      },
      TransactionDetailsApi: function () {
        sdkMocks.transactionDetailsConstructor();
        return { getTransaction: sdkMocks.getTransaction };
      },
      CapturePaymentRequest: EmptyRequest,
      CreatePaymentRequest: EmptyRequest,
    },
  };
});

import {
  captureAuthorizedPayment,
  createPaymentWithPaymentInstrument,
  getCaptureStatus,
} from "../src/modules/payments/payments.service.js";
import { cybsConfig } from "../src/config/cybs.config.js";

async function rememberAuthorization(
  paymentId: string,
  amount = "10.00",
  currency = "USD",
) {
  sdkMocks.createPayment.mockImplementationOnce((_request, callback) =>
    callback(null, { id: paymentId, status: "AUTHORIZED" }, { status: 201 }),
  );

  await createPaymentWithPaymentInstrument({
    paymentInstrumentId: `pi-${paymentId}`,
    amount,
    currency,
  });
}

function successfulCapture(captureId: string, amount = "10.00") {
  sdkMocks.capturePayment.mockImplementationOnce(
    (_request, _paymentId, callback) =>
      callback(
        null,
        {
          id: captureId,
          status: "PENDING",
          submitTimeUtc: "2026-10-14T18:00:00Z",
          reconciliationId: `reconciliation-${captureId}`,
          orderInformation: {
            amountDetails: { totalAmount: amount, currency: "USD" },
          },
        },
        { status: 201 },
      ),
  );
}

describe("capture service", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    cybsConfig.runEnvironment = "apitest.cybersource.com";
    cybsConfig.allowProductionCaptures = false;
    sdkMocks.capturePayment.mockReset();
    sdkMocks.createPayment.mockReset();
    sdkMocks.getTransaction.mockReset();
    sdkMocks.captureConstructor.mockClear();
    sdkMocks.paymentsConstructor.mockClear();
    sdkMocks.transactionDetailsConstructor.mockClear();
  });

  it("submits a successful capture with the exact installed SDK signature", async () => {
    await rememberAuthorization("payment-success-1");
    successfulCapture("capture-success-1");

    const result = await captureAuthorizedPayment("payment-success-1", {
      amount: "10.00",
      currency: "USD",
      referenceCode: "CAPTURE-SUCCESS-1",
    });

    expect(sdkMocks.capturePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReferenceInformation: { code: "CAPTURE-SUCCESS-1" },
        orderInformation: {
          amountDetails: { totalAmount: "10.00", currency: "USD" },
        },
      }),
      "payment-success-1",
      expect.any(Function),
    );
    expect(result.sanitized).toEqual({
      captureId: "capture-success-1",
      status: "PENDING",
      paymentId: "payment-success-1",
      amount: "10.00",
      currency: "USD",
      submitTimeUtc: "2026-10-14T18:00:00Z",
      reconciliationId: "reconciliation-capture-success-1",
    });
  });

  it("releases the reservation only for a definitive SDK-model rejection", async () => {
    await rememberAuthorization("payment-definitive-rejection");
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) =>
        callback(
          {
            status: 400,
            response: {
              body: {
                status: "INVALID_REQUEST",
                reason: "INVALID_AMOUNT",
                card: { number: "4111111111111111" },
              },
            },
          },
          undefined,
          undefined,
        ),
    );

    const request = captureAuthorizedPayment("payment-definitive-rejection", {
      amount: "10.00",
      currency: "USD",
      referenceCode: "CAPTURE-DEFINITIVE-REJECTION",
    });

    await expect(request).rejects.toMatchObject({
      message: "CyberSource request failed",
      statusCode: 400,
      code: "INVALID_AMOUNT",
    });
    await expect(request).rejects.not.toHaveProperty("response");

    successfulCapture("capture-after-definitive-rejection");
    await expect(
      captureAuthorizedPayment("payment-definitive-rejection", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-AFTER-DEFINITIVE-REJECTION",
      }),
    ).resolves.toMatchObject({
      sanitized: { captureId: "capture-after-definitive-rejection" },
    });
  });

  it("rejects an invalid amount and missing payment ID before calling the SDK", async () => {
    await expect(
      captureAuthorizedPayment("", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-MISSING-ID",
      }),
    ).rejects.toMatchObject({ code: "MISSING_PAYMENT_ID" });

    await expect(
      captureAuthorizedPayment("payment-invalid-amount", {
        amount: "0.00",
        currency: "USD",
        referenceCode: "CAPTURE-INVALID-AMOUNT",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CAPTURE_AMOUNT" });

    expect(sdkMocks.captureConstructor).not.toHaveBeenCalled();
  });

  it("requires an explicit opt-in before captures outside the sandbox", async () => {
    process.env.NODE_ENV = "production";
    cybsConfig.runEnvironment = "api.cybersource.com";

    await expect(
      captureAuthorizedPayment("payment-production-guard", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-PRODUCTION-GUARD",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PRODUCTION_CAPTURES_DISABLED",
    });
    expect(sdkMocks.captureConstructor).not.toHaveBeenCalled();
  });

  it("marks a local timeout unknown and blocks every later capture for the payment", async () => {
    await rememberAuthorization("payment-timeout-1");
    vi.useFakeTimers();
    try {
      sdkMocks.capturePayment.mockImplementation(() => undefined);
      const request = captureAuthorizedPayment("payment-timeout-1", {
        amount: "5.00",
        currency: "USD",
        referenceCode: "CAPTURE-TIMEOUT-1",
      });
      const rejection = expect(request).rejects.toMatchObject({
        statusCode: 504,
        code: "CAPTURE_OUTCOME_UNKNOWN",
      });

      await vi.advanceTimersByTimeAsync(30000);
      await rejection;

      await expect(
        captureAuthorizedPayment("payment-timeout-1", {
          amount: "5.00",
          currency: "USD",
          referenceCode: "CAPTURE-TIMEOUT-RETRY-DIFFERENT-REFERENCE",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CAPTURE_OUTCOME_UNKNOWN",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats network interruption as unknown and retains the reservation", async () => {
    await rememberAuthorization("payment-network-unknown");
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) =>
        callback(Object.assign(new Error("socket reset"), { code: "ECONNRESET" })),
    );

    await expect(
      captureAuthorizedPayment("payment-network-unknown", {
        amount: "4.00",
        currency: "USD",
        referenceCode: "CAPTURE-NETWORK-UNKNOWN",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_OUTCOME_UNKNOWN" });

    expect(sdkMocks.capturePayment).toHaveBeenCalledTimes(1);
    await expect(
      captureAuthorizedPayment("payment-network-unknown", {
        amount: "1.00",
        currency: "USD",
        referenceCode: "CAPTURE-NETWORK-NEW-REFERENCE",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_OUTCOME_UNKNOWN" });
    expect(sdkMocks.capturePayment).toHaveBeenCalledTimes(1);
  });

  it("does not treat an unclassified 4xx duplicate response as definitive", async () => {
    await rememberAuthorization("payment-upstream-duplicate");
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) =>
        callback({
          status: 400,
          response: {
            body: {
              status: "INVALID_REQUEST",
              reason: "DUPLICATE_REQUEST",
            },
          },
        }),
    );

    await expect(
      captureAuthorizedPayment("payment-upstream-duplicate", {
        amount: "5.00",
        currency: "USD",
        referenceCode: "CAPTURE-UPSTREAM-DUPLICATE",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_OUTCOME_UNKNOWN" });

    await expect(
      captureAuthorizedPayment("payment-upstream-duplicate", {
        amount: "1.00",
        currency: "USD",
        referenceCode: "CAPTURE-UPSTREAM-DUPLICATE-NEW",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_OUTCOME_UNKNOWN" });
  });

  it("treats SDK response parsing failure after submission as unknown", async () => {
    await rememberAuthorization("payment-response-parsing");
    const responseData = {
      get id() {
        throw new Error("response parse failed");
      },
      status: "PENDING",
    };
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) =>
        callback(null, responseData, { status: 201 }),
    );

    await expect(
      captureAuthorizedPayment("payment-response-parsing", {
        amount: "5.00",
        currency: "USD",
        referenceCode: "CAPTURE-RESPONSE-PARSING",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_OUTCOME_UNKNOWN" });
  });

  it("fails closed when an authorization is missing after a backend restart", async () => {
    await expect(
      captureAuthorizedPayment("payment-not-in-this-process", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-AFTER-RESTART",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "AUTHORIZATION_CONTEXT_MISSING",
    });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("blocks overlapping captures for one payment even with different references", async () => {
    await rememberAuthorization("payment-concurrent", "10.00");
    let completeFirstCapture: ((...args: any[]) => void) | undefined;
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) => {
        completeFirstCapture = callback;
      },
    );

    const firstCapture = captureAuthorizedPayment("payment-concurrent", {
      amount: "5.00",
      currency: "USD",
      referenceCode: "CAPTURE-CONCURRENT-1",
    });

    await expect(
      captureAuthorizedPayment("payment-concurrent", {
        amount: "5.00",
        currency: "USD",
        referenceCode: "CAPTURE-CONCURRENT-2",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_IN_PROGRESS" });

    completeFirstCapture?.(
      null,
      { id: "capture-concurrent-1", status: "PENDING" },
      { status: 201 },
    );
    await expect(firstCapture).resolves.toMatchObject({
      sanitized: { captureId: "capture-concurrent-1" },
    });
    expect(sdkMocks.capturePayment).toHaveBeenCalledTimes(1);
  });

  it("rejects an authorization currency mismatch", async () => {
    await rememberAuthorization("payment-currency-mismatch", "10.00", "USD");

    await expect(
      captureAuthorizedPayment("payment-currency-mismatch", {
        amount: "5.00",
        currency: "EUR",
        referenceCode: "CAPTURE-CURRENCY-MISMATCH",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_CURRENCY_MISMATCH" });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("rejects capture totals above an authorization known in memory", async () => {
    await rememberAuthorization("payment-known-amount", "10.00");

    await expect(
      captureAuthorizedPayment("payment-known-amount", {
        amount: "10.01",
        currency: "USD",
        referenceCode: "CAPTURE-TOO-LARGE-1",
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CAPTURE_AMOUNT_EXCEEDS_AUTHORIZATION",
    });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("rejects another capture after the full authorization was captured", async () => {
    await rememberAuthorization("payment-fully-captured", "5.00");
    successfulCapture("capture-full", "5.00");

    await captureAuthorizedPayment("payment-fully-captured", {
      amount: "5.00",
      currency: "USD",
      referenceCode: "CAPTURE-FULL-1",
    });

    await expect(
      captureAuthorizedPayment("payment-fully-captured", {
        amount: "1.00",
        currency: "USD",
        referenceCode: "CAPTURE-FULL-2",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_ALREADY_FULLY_CAPTURED" });
    expect(sdkMocks.capturePayment).toHaveBeenCalledTimes(1);
  });

  it("retains the exact payment and reference duplicate check", async () => {
    await rememberAuthorization("payment-reference-duplicate", "6.00");
    successfulCapture("capture-reference-duplicate", "3.00");
    const payload = {
      amount: "3.00",
      currency: "USD",
      referenceCode: "CAPTURE-REFERENCE-DUPLICATE",
    };

    await captureAuthorizedPayment("payment-reference-duplicate", payload);

    await expect(
      captureAuthorizedPayment("payment-reference-duplicate", payload),
    ).rejects.toMatchObject({ code: "DUPLICATE_CAPTURE" });
    expect(sdkMocks.capturePayment).toHaveBeenCalledTimes(1);
  });

  it("allows the controlled production path only after authoritative verification", async () => {
    await rememberAuthorization("payment-production-verified");
    process.env.NODE_ENV = "production";
    cybsConfig.runEnvironment = "api.cybersource.com";
    cybsConfig.allowProductionCaptures = true;
    sdkMocks.getTransaction.mockImplementationOnce((paymentId, callback) =>
      callback(
        null,
        {
          id: paymentId,
          applicationInformation: {
            applications: [{ name: "ics_auth", rCode: "1" }],
          },
          orderInformation: {
            amountDetails: {
              authorizedAmount: "10.00",
              currency: "USD",
            },
          },
          _links: { relatedTransactions: [] },
        },
        { status: 200 },
      ),
    );
    successfulCapture("capture-production-verified");

    await expect(
      captureAuthorizedPayment("payment-production-verified", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-PRODUCTION-VERIFIED",
      }),
    ).resolves.toMatchObject({
      sanitized: { captureId: "capture-production-verified" },
    });
    expect(sdkMocks.getTransaction).toHaveBeenCalledWith(
      "payment-production-verified",
      expect.any(Function),
    );
  });

  it("rejects a production payment that is not approved for capture", async () => {
    await rememberAuthorization("payment-production-declined");
    process.env.NODE_ENV = "production";
    cybsConfig.runEnvironment = "api.cybersource.com";
    cybsConfig.allowProductionCaptures = true;
    sdkMocks.getTransaction.mockImplementationOnce((paymentId, callback) =>
      callback(
        null,
        {
          id: paymentId,
          applicationInformation: {
            applications: [{ name: "ics_auth", rCode: "0" }],
          },
          orderInformation: {
            amountDetails: {
              authorizedAmount: "10.00",
              currency: "USD",
            },
          },
          _links: { relatedTransactions: [] },
        },
        { status: 200 },
      ),
    );

    await expect(
      captureAuthorizedPayment("payment-production-declined", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-PRODUCTION-DECLINED",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_NOT_CAPTURE_ELIGIBLE" });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("rejects a production payment already fully captured in related transactions", async () => {
    await rememberAuthorization("payment-production-fully-captured");
    process.env.NODE_ENV = "production";
    cybsConfig.runEnvironment = "api.cybersource.com";
    cybsConfig.allowProductionCaptures = true;
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) => {
      if (transactionId === "payment-production-fully-captured") {
        callback(
          null,
          {
            id: transactionId,
            applicationInformation: {
              applications: [{ name: "ics_auth", rCode: "1" }],
            },
            orderInformation: {
              amountDetails: {
                authorizedAmount: "10.00",
                currency: "USD",
              },
            },
            _links: {
              relatedTransactions: [
                { href: "/tss/v2/transactions/capture-remote-full" },
              ],
            },
          },
          { status: 200 },
        );
        return;
      }

      callback(
        null,
        {
          id: "capture-remote-full",
          rootId: "payment-production-fully-captured",
          applicationInformation: {
            applications: [
              { name: "ics_bill", rCode: "1", status: "SETTLED" },
            ],
          },
          orderInformation: {
            amountDetails: { totalAmount: "10.00", currency: "USD" },
          },
        },
        { status: 200 },
      );
    });

    await expect(
      captureAuthorizedPayment("payment-production-fully-captured", {
        amount: "1.00",
        currency: "USD",
        referenceCode: "CAPTURE-PRODUCTION-ALREADY-FULL",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_ALREADY_FULLY_CAPTURED" });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("fails closed in production when related capture history is unavailable", async () => {
    await rememberAuthorization("payment-production-unverified");
    process.env.NODE_ENV = "production";
    cybsConfig.runEnvironment = "api.cybersource.com";
    cybsConfig.allowProductionCaptures = true;
    sdkMocks.getTransaction.mockImplementationOnce((paymentId, callback) =>
      callback(
        null,
        {
          id: paymentId,
          applicationInformation: {
            applications: [{ name: "ics_auth", rCode: "1" }],
          },
          orderInformation: {
            amountDetails: {
              authorizedAmount: "10.00",
              currency: "USD",
            },
          },
        },
        { status: 200 },
      ),
    );

    await expect(
      captureAuthorizedPayment("payment-production-unverified", {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-PRODUCTION-UNVERIFIED",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_HISTORY_UNVERIFIED" });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("retrieves capture status from the nested card-settlement application", async () => {
    sdkMocks.getTransaction.mockImplementationOnce((captureId, callback) =>
      callback(
        null,
        {
          id: captureId,
          rootId: "payment-status-1",
          status: null,
          submitTimeUTC: null,
          reconciliationId: "top-level-reconciliation",
          applicationInformation: {
            status: "PENDING",
            applications: [
              { name: "ics_auth", status: "AUTHORIZED" },
              {
                name: "ics_bill",
                status: "TRANSMITTED",
                reconciliationId: "capture-reconciliation",
              },
            ],
          },
          orderInformation: {
            amountDetails: { totalAmount: "10.00", currency: "USD" },
          },
        },
        {
          status: 200,
          body: { submitTimeUtc: "2026-10-15T18:00:00Z" },
        },
      ),
    );

    const result = await getCaptureStatus("capture-status-1");

    expect(sdkMocks.getTransaction).toHaveBeenCalledWith(
      "capture-status-1",
      expect.any(Function),
    );
    expect(result).toEqual({
      sanitized: {
        captureId: "capture-status-1",
        paymentId: "payment-status-1",
        status: "TRANSMITTED",
        submitTimeUtc: "2026-10-15T18:00:00Z",
        reconciliationId: "capture-reconciliation",
        amount: "10.00",
        currency: "USD",
      },
      responseStatus: 200,
    });
  });

  it("does not use an authorization status when capture status is missing", async () => {
    sdkMocks.getTransaction.mockImplementationOnce((captureId, callback) =>
      callback(
        null,
        {
          id: captureId,
          status: "AUTHORIZED",
          applicationInformation: {
            applications: [{ name: "ics_auth", status: "AUTHORIZED" }],
          },
        },
        { status: 200 },
      ),
    );

    await expect(getCaptureStatus("capture-without-bill-app")).resolves.toMatchObject({
      sanitized: {
        captureId: "capture-without-bill-app",
        status: null,
        submitTimeUtc: null,
      },
    });
  });
});
