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

import { cybsConfig } from "../src/config/cybs.config.js";
import {
  captureAuthorizedPayment,
  createPaymentWithPaymentInstrument,
  getCaptureReadiness,
} from "../src/modules/payments/payments.service.js";

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

function authorizationTransaction(
  paymentId: string,
  relatedTransactions: Array<{ href: string }> | undefined = [],
  amount = "10.00",
  currency = "USD",
) {
  return {
    id: paymentId,
    applicationInformation: {
      applications: [
        { name: "ics_auth", rCode: "1", status: "AUTHORIZED" },
      ],
    },
    orderInformation: {
      amountDetails: { authorizedAmount: amount, currency },
    },
    ...(relatedTransactions === undefined
      ? {}
      : { _links: { relatedTransactions } }),
  };
}

function relatedLink(transactionId: string) {
  return { href: `/tss/v2/transactions/${transactionId}` };
}

function settledCapture(
  captureId: string,
  paymentId: string,
  amount: string | undefined,
  currency = "USD",
  status = "SETTLED",
) {
  return {
    id: captureId,
    rootId: paymentId,
    applicationInformation: {
      applications: [{ name: "ics_bill", rCode: "1", status }],
    },
    orderInformation: {
      amountDetails: {
        ...(amount === undefined ? {} : { totalAmount: amount }),
        currency,
      },
    },
  };
}

function returnTransaction(transaction: any) {
  return (_transactionId: string, callback: (...args: any[]) => void) =>
    callback(null, transaction, { status: 200 });
}

describe("capture readiness service", () => {
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

  it("reports a verified authorization with an explicit empty capture history as eligible", async () => {
    const paymentId = "readiness-valid-empty";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementationOnce(
      returnTransaction(authorizationTransaction(paymentId)),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toEqual({
      paymentId,
      eligible: true,
      authorizedAmount: "10.00",
      capturedAmount: "0.00",
      currency: "USD",
      historyVerified: true,
      availableAmount: "10.00",
      reason: null,
    });
  });

  it("distinguishes an authorization that is not yet visible", async () => {
    const paymentId = "readiness-not-visible";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementationOnce((_id, callback) =>
      callback({ status: 404, response: { body: { reason: "NOT_FOUND" } } }),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      paymentId,
      eligible: false,
      historyVerified: false,
      reason: { code: "AUTHORIZATION_NOT_VISIBLE" },
    });
  });

  it("fails closed when related transaction history is missing rather than empty", async () => {
    const paymentId = "readiness-history-missing";
    await rememberAuthorization(paymentId);
    const transactionWithoutHistory = authorizationTransaction(paymentId);
    delete (transactionWithoutHistory as any)._links;
    sdkMocks.getTransaction.mockImplementationOnce(
      returnTransaction(transactionWithoutHistory),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toEqual({
      paymentId,
      eligible: false,
      authorizedAmount: "10.00",
      capturedAmount: "0.00",
      currency: "USD",
      historyVerified: false,
      availableAmount: "10.00",
      reason: {
        code: "CAPTURE_HISTORY_UNVERIFIED",
        message:
          "CyberSource did not provide a related-transaction history snapshot",
      },
    });
  });

  it("uses capture totalAmount, not authorizedAmount, for partial capture totals", async () => {
    const paymentId = "readiness-partial";
    const captureId = "readiness-partial-capture";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) => {
      const transaction =
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : {
              ...settledCapture(captureId, paymentId, "3.00"),
              orderInformation: {
                amountDetails: {
                  authorizedAmount: "10.00",
                  totalAmount: "3.00",
                  currency: "USD",
                },
              },
            };
      callback(null, transaction, { status: 200 });
    });

    await expect(getCaptureReadiness(paymentId)).resolves.toEqual({
      paymentId,
      eligible: true,
      authorizedAmount: "10.00",
      capturedAmount: "3.00",
      currency: "USD",
      historyVerified: true,
      availableAmount: "7.00",
      reason: null,
    });
  });

  it("reports a fully captured authorization as ineligible", async () => {
    const paymentId = "readiness-full";
    const captureId = "readiness-full-capture";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : settledCapture(captureId, paymentId, "10.00"),
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      authorizedAmount: "10.00",
      capturedAmount: "10.00",
      availableAmount: "0.00",
      historyVerified: true,
      reason: { code: "PAYMENT_ALREADY_FULLY_CAPTURED" },
    });
  });

  it("reports a precise negative balance when verified captures exceed the authorization", async () => {
    const paymentId = "readiness-over-captured";
    const captureId = "readiness-over-captured-id";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : settledCapture(captureId, paymentId, "10.50"),
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      capturedAmount: "10.50",
      availableAmount: "-0.50",
      historyVerified: true,
      reason: { code: "CAPTURE_TOTAL_EXCEEDS_AUTHORIZATION" },
    });
  });

  it("rejects an authorization with an accepted reversal", async () => {
    const paymentId = "readiness-reversed";
    const reversalId = "readiness-reversal";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(reversalId)])
          : {
              id: reversalId,
              rootId: paymentId,
              applicationInformation: {
                applications: [
                  {
                    name: "ics_auth_reversal",
                    rCode: "1",
                    status: "REVERSED",
                  },
                ],
              },
            },
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      reason: { code: "AUTHORIZATION_NOT_CAPTURE_ELIGIBLE" },
    });
  });

  it("does not trust the first of multiple conflicting capture applications", async () => {
    const paymentId = "readiness-multiple-applications";
    const captureId = "readiness-multiple-applications-capture";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : {
              ...settledCapture(captureId, paymentId, "3.00"),
              applicationInformation: {
                applications: [
                  { name: "ics_bill", rCode: "1", status: "SETTLED" },
                  { name: "ics_ap_capture", rCode: "1", status: "PENDING" },
                ],
              },
            },
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      historyVerified: false,
      reason: { code: "CAPTURE_HISTORY_UNVERIFIED" },
    });
  });

  it("fails closed when an accepted capture has no totalAmount", async () => {
    const paymentId = "readiness-missing-capture-amount";
    const captureId = "readiness-missing-capture-amount-id";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : settledCapture(captureId, paymentId, undefined),
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      reason: { code: "CAPTURE_HISTORY_UNVERIFIED" },
    });
  });

  it("rejects a related capture in a different currency", async () => {
    const paymentId = "readiness-related-currency";
    const captureId = "readiness-related-currency-capture";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : settledCapture(captureId, paymentId, "3.00", "EUR"),
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      reason: { code: "CAPTURE_CURRENCY_MISMATCH" },
    });
  });

  it("counts a pending capture but blocks another capture until reconciliation", async () => {
    const paymentId = "readiness-pending";
    const captureId = "readiness-pending-capture";
    await rememberAuthorization(paymentId);
    sdkMocks.getTransaction.mockImplementation((transactionId, callback) =>
      callback(
        null,
        transactionId === paymentId
          ? authorizationTransaction(paymentId, [relatedLink(captureId)])
          : settledCapture(captureId, paymentId, "3.00", "USD", "PENDING"),
        { status: 200 },
      ),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      capturedAmount: "3.00",
      availableAmount: "7.00",
      historyVerified: true,
      reason: { code: "CAPTURE_RECONCILIATION_PENDING" },
    });
  });

  it("reports a prior unknown capture without making a status lookup", async () => {
    const paymentId = "readiness-unknown";
    await rememberAuthorization(paymentId);
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) =>
        callback(Object.assign(new Error("socket reset"), { code: "ECONNRESET" })),
    );

    await expect(
      captureAuthorizedPayment(paymentId, {
        amount: "2.00",
        currency: "USD",
        referenceCode: "READINESS-UNKNOWN-CAPTURE",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_OUTCOME_UNKNOWN" });

    sdkMocks.getTransaction.mockClear();
    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      reason: { code: "CAPTURE_OUTCOME_UNKNOWN" },
    });
    expect(sdkMocks.getTransaction).not.toHaveBeenCalled();
  });

  it("reports an in-flight capture without racing a status lookup", async () => {
    const paymentId = "readiness-in-flight";
    await rememberAuthorization(paymentId);
    let completeCapture: ((...args: any[]) => void) | undefined;
    sdkMocks.capturePayment.mockImplementationOnce(
      (_request, _paymentId, callback) => {
        completeCapture = callback;
      },
    );

    const capture = captureAuthorizedPayment(paymentId, {
      amount: "2.00",
      currency: "USD",
      referenceCode: "READINESS-IN-FLIGHT-CAPTURE",
    });

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: false,
      reason: { code: "CAPTURE_IN_PROGRESS" },
    });
    expect(sdkMocks.getTransaction).not.toHaveBeenCalled();

    completeCapture?.(
      null,
      { id: "readiness-in-flight-capture-id", status: "PENDING" },
      { status: 201 },
    );
    await expect(capture).resolves.toMatchObject({
      sanitized: { captureId: "readiness-in-flight-capture-id" },
    });
  });

  it("fails closed when the local authorization context was lost after restart", async () => {
    sdkMocks.getTransaction.mockClear();

    await expect(
      getCaptureReadiness("readiness-after-restart"),
    ).resolves.toMatchObject({
      eligible: false,
      reason: { code: "AUTHORIZATION_CONTEXT_MISSING" },
    });
    expect(sdkMocks.getTransaction).not.toHaveBeenCalled();
  });

  it("revalidates readiness inside the actual production capture path", async () => {
    const paymentId = "readiness-production-revalidation";
    await rememberAuthorization(paymentId);
    const transactionWithoutHistory = authorizationTransaction(paymentId);
    delete (transactionWithoutHistory as any)._links;
    sdkMocks.getTransaction
      .mockImplementationOnce(
        returnTransaction(authorizationTransaction(paymentId)),
      )
      .mockImplementationOnce(
        returnTransaction(transactionWithoutHistory),
      );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: true,
    });

    process.env.NODE_ENV = "production";
    cybsConfig.runEnvironment = "api.cybersource.com";
    cybsConfig.allowProductionCaptures = true;

    await expect(
      captureAuthorizedPayment(paymentId, {
        amount: "2.00",
        currency: "USD",
        referenceCode: "READINESS-PRODUCTION-REVALIDATION",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_HISTORY_UNVERIFIED" });
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });

  it("never invokes a financial SDK operation while evaluating readiness", async () => {
    const paymentId = "readiness-read-only";
    await rememberAuthorization(paymentId);
    sdkMocks.createPayment.mockClear();
    sdkMocks.capturePayment.mockClear();
    sdkMocks.getTransaction.mockImplementationOnce(
      returnTransaction(authorizationTransaction(paymentId)),
    );

    await expect(getCaptureReadiness(paymentId)).resolves.toMatchObject({
      eligible: true,
    });
    expect(sdkMocks.getTransaction).toHaveBeenCalledTimes(1);
    expect(sdkMocks.createPayment).not.toHaveBeenCalled();
    expect(sdkMocks.capturePayment).not.toHaveBeenCalled();
  });
});
