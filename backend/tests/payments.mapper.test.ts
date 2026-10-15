import { describe, expect, it } from "vitest";
import {
  buildCapturePaymentRequest,
  buildPaymentRequest,
  mapCaptureResponse,
  sanitizeCaptureStatusResponse,
} from "../src/modules/payments/payments.mapper.js";

describe("capture mappers", () => {
  it("preserves authorization-only behavior for Payment Instrument payments", () => {
    const result = buildPaymentRequest({
      paymentInstrumentId: "pi-1",
      amount: "10.00",
      currency: "USD",
    });

    expect(result.processingInformation).toEqual({ capture: false });
  });

  it("builds the installed SDK CapturePaymentRequest structure", () => {
    const result = buildCapturePaymentRequest({
      amount: "10.00",
      currency: "USD",
      referenceCode: "CAPTURE-ORDER-001",
    });

    expect(result).toMatchObject({
      clientReferenceInformation: { code: "CAPTURE-ORDER-001" },
      orderInformation: {
        amountDetails: { totalAmount: "10.00", currency: "USD" },
      },
    });
  });

  it("returns only the capture response allowlist", () => {
    const result = mapCaptureResponse(
      {
        id: "capture-1",
        status: "PENDING",
        submitTimeUtc: "2026-10-14T18:00:00Z",
        reconciliationId: "reconciliation-1",
        orderInformation: {
          amountDetails: { totalAmount: "10.00", currency: "USD" },
          billTo: { firstName: "Do not return" },
        },
        paymentInformation: { card: { number: "4111111111111111" } },
      },
      { status: 201 },
      "payment-1",
      {
        amount: "10.00",
        currency: "USD",
        referenceCode: "CAPTURE-ORDER-001",
      },
    );

    expect(result).toEqual({
      sanitized: {
        captureId: "capture-1",
        status: "PENDING",
        paymentId: "payment-1",
        amount: "10.00",
        currency: "USD",
        submitTimeUtc: "2026-10-14T18:00:00Z",
        reconciliationId: "reconciliation-1",
      },
      responseStatus: 201,
    });
    expect(JSON.stringify(result)).not.toContain("4111111111111111");
  });

  it("sanitizes transaction details used for capture lookup", () => {
    expect(
      sanitizeCaptureStatusResponse(
        {
          id: "capture-1",
          rootId: "payment-1",
          status: null,
          submitTimeUTC: "2026-10-15T18:00:00Z",
          reconciliationId: "reconciliation-1",
          applicationInformation: {
            status: "PENDING",
            applications: [
              { name: "ics_auth", status: "AUTHORIZED" },
              { name: "ics_bill", status: "SETTLED" },
            ],
          },
          orderInformation: {
            amountDetails: { totalAmount: "10.00", currency: "USD" },
            billTo: { email: "do-not-return@example.com" },
          },
        },
        "capture-1",
      ),
    ).toEqual({
      captureId: "capture-1",
      status: "SETTLED",
      paymentId: "payment-1",
      amount: "10.00",
      currency: "USD",
      submitTimeUtc: "2026-10-15T18:00:00Z",
      reconciliationId: "reconciliation-1",
    });
  });

  it("uses the transaction detail application status and raw response submission time", () => {
    expect(
      sanitizeCaptureStatusResponse(
        {
          id: "capture-nested",
          rootId: "payment-nested",
          status: null,
          submitTimeUTC: null,
          applicationInformation: {
            status: "TRANSMITTED",
            applications: [
              { name: "ics_auth", status: "AUTHORIZED" },
              {
                name: "ics_bill",
                reconciliationId: "nested-reconciliation",
              },
            ],
          },
          orderInformation: {
            amountDetails: { totalAmount: "10", currency: "NIO" },
          },
        },
        "capture-nested",
        { submitTimeUtc: "2026-10-14T23:43:51Z" },
      ),
    ).toEqual({
      captureId: "capture-nested",
      paymentId: "payment-nested",
      status: "TRANSMITTED",
      submitTimeUtc: "2026-10-14T23:43:51Z",
      reconciliationId: "nested-reconciliation",
      amount: "10",
      currency: "NIO",
    });
  });

  it("does not report an unrelated authorization as capture status", () => {
    expect(
      sanitizeCaptureStatusResponse(
        {
          id: "authorization-id",
          status: "AUTHORIZED",
          submitTimeUTC: "2026-10-15T18:00:00Z",
          applicationInformation: {
            applications: [{ name: "ics_auth", status: "AUTHORIZED" }],
          },
        },
        "requested-capture-id",
      ),
    ).toEqual({
      captureId: "authorization-id",
      paymentId: null,
      status: null,
      submitTimeUtc: null,
      reconciliationId: null,
      amount: null,
      currency: null,
    });
  });

  it("returns an unknown status when multiple capture applications conflict", () => {
    expect(
      sanitizeCaptureStatusResponse(
        {
          id: "capture-conflicting-applications",
          rootId: "payment-conflicting-applications",
          status: "SETTLED",
          applicationInformation: {
            status: "SETTLED",
            applications: [
              { name: "ics_bill", status: "SETTLED" },
              { name: "ics_ap_capture", status: "PENDING" },
            ],
          },
          orderInformation: {
            amountDetails: { totalAmount: "3.00", currency: "USD" },
          },
        },
        "capture-conflicting-applications",
      ),
    ).toMatchObject({
      captureId: "capture-conflicting-applications",
      paymentId: "payment-conflicting-applications",
      status: null,
      amount: "3.00",
      currency: "USD",
    });
  });
});
