import { cybsConfig } from "../../config/cybs.config.js";
import { cybersourceRestClient } from "../../cybs/cybsClient.js";
import type {
  CapturePaymentInput,
  CreatePaymentWithPaymentInstrumentInput,
} from "./payments.dto.js";

export function buildPaymentRequest(
  payload: CreatePaymentWithPaymentInstrumentInput,
) {
  const requestObj = new cybersourceRestClient.CreatePaymentRequest();

  requestObj.clientReferenceInformation = {
    code: payload.referenceCode || `TMS-PI-${Date.now()}`,
  };

  requestObj.processingInformation = {
    capture: false,
  };

  requestObj.paymentInformation = {
    paymentInstrument: {
      id: payload.paymentInstrumentId,
    },
  };

  requestObj.orderInformation = {
    amountDetails: {
      totalAmount: payload.amount,
      currency: payload.currency,
    },
    billTo: {
      firstName: payload.billTo?.firstName || "Carlos",
      lastName: payload.billTo?.lastName || "Rodriguez",
      address1: payload.billTo?.address1 || "Managua",
      locality: payload.billTo?.locality || "Managua",
      administrativeArea: payload.billTo?.administrativeArea || "MN",
      postalCode: payload.billTo?.postalCode || "11001",
      country: payload.billTo?.country || "NI",
      email: payload.billTo?.email || "cjrodm@outlook.es",
      phoneNumber: payload.billTo?.phoneNumber || "50578987797",
    },
  };

  return requestObj;
}

function sanitizePaymentResponse(data: any) {
  return {
    id: data?.id,
    status: data?.status,
    submitTimeUtc: data?.submitTimeUtc,
    clientReferenceInformation: data?.clientReferenceInformation,
    processingInformation: data?.processingInformation,
    processorInformation: {
      approvalCode: data?.processorInformation?.approvalCode,
      responseCode: data?.processorInformation?.responseCode,
      transactionId: data?.processorInformation?.transactionId,
      networkTransactionId: data?.processorInformation?.networkTransactionId,
    },
    paymentInformation: {
      tokenizedCard: data?.paymentInformation?.tokenizedCard,
      paymentInstrument: data?.paymentInformation?.paymentInstrument,
      instrumentIdentifier: data?.paymentInformation?.instrumentIdentifier,
    },
    orderInformation: data?.orderInformation,
  };
}

export function buildCapturePaymentRequest(payload: CapturePaymentInput) {
  const requestObj = new cybersourceRestClient.CapturePaymentRequest();

  requestObj.clientReferenceInformation = {
    code: payload.referenceCode,
  };

  requestObj.orderInformation = {
    amountDetails: {
      totalAmount: payload.amount,
      currency: payload.currency,
    },
  };

  return requestObj;
}

export function mapPaymentResponse(data: any, response: any) {
  return {
    ...(cybsConfig.includeRawResponse && { raw: data }),
    sanitized: sanitizePaymentResponse(data),
    responseStatus: response?.status,
  };
}
export function mapCaptureResponse(
  data: any,
  response: any,
  paymentId: string,
  payload: CapturePaymentInput,
) {
  return {
    sanitized: {
      captureId: data?.id ?? null,
      paymentId,
      status: data?.status ?? null,
      submitTimeUtc: data?.submitTimeUtc ?? null,
      reconciliationId: data?.reconciliationId ?? null,
      amount: payload.amount,
      currency: payload.currency,
    },
    responseStatus: response?.status ?? null,
  };
}

export function mapCaptureStatusResponse(
  data: any,
  response: any,
  captureId: string,
) {
  return {
    sanitized: sanitizeCaptureStatusResponse(
      data,
      captureId,
      response?.body,
    ),
    responseStatus: response?.status ?? null,
  };
}

const captureApplicationNames = new Set(["ics_bill", "ics_ap_capture"]);

function readNonEmptyString(...values: unknown[]): string | null {
  const value = values.find(
    (candidate) =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  return typeof value === "string" ? value : null;
}

function selectCaptureApplications(source: any): any[] {
  const applications = source?.applicationInformation?.applications;

  if (!Array.isArray(applications)) {
    return [];
  }

  return applications.filter(
    (application: any) =>
      typeof application?.name === "string" &&
      captureApplicationNames.has(application.name.trim().toLowerCase()),
  );
}

function readConsistentApplicationValue(
  applications: any[],
  property: "status" | "reconciliationId",
): string | null {
  const values = applications.map((application) =>
    readNonEmptyString(application?.[property]),
  );

  if (applications.length > 1 && values.some((value) => value === null)) {
    return null;
  }

  const distinctValues = new Set(
    values.filter((value): value is string => value !== null),
  );

  return distinctValues.size === 1 ? [...distinctValues][0] : null;
}

export function sanitizeCaptureStatusResponse(
  data: any,
  captureId: string,
  rawResponseBody?: any,
) {
  const dataCaptureApplications = selectCaptureApplications(data);
  const rawCaptureApplications = selectCaptureApplications(rawResponseBody);
  const captureApplications = dataCaptureApplications.length
    ? dataCaptureApplications
    : rawCaptureApplications;
  const hasCaptureApplication = captureApplications.length > 0;
  const captureStatus = readConsistentApplicationValue(
    captureApplications,
    "status",
  );
  const captureReconciliationId = readConsistentApplicationValue(
    captureApplications,
    "reconciliationId",
  );
  const hasAmbiguousCaptureStatus =
    captureApplications.length > 1 && captureStatus === null;
  const dataAmountDetails = data?.orderInformation?.amountDetails;
  const rawAmountDetails = rawResponseBody?.orderInformation?.amountDetails;

  return {
    captureId: readNonEmptyString(data?.id, rawResponseBody?.id, captureId),
    paymentId: readNonEmptyString(data?.rootId, rawResponseBody?.rootId),
    status: hasCaptureApplication
      ? hasAmbiguousCaptureStatus
        ? null
        : readNonEmptyString(
            captureStatus,
            data?.applicationInformation?.status,
            rawResponseBody?.applicationInformation?.status,
            data?.status,
            rawResponseBody?.status,
          )
      : null,
    submitTimeUtc: hasCaptureApplication
      ? readNonEmptyString(
          data?.submitTimeUTC,
          data?.submitTimeUtc,
          rawResponseBody?.submitTimeUTC,
          rawResponseBody?.submitTimeUtc,
        )
      : null,
    reconciliationId: hasCaptureApplication
      ? readNonEmptyString(
          captureReconciliationId,
          data?.reconciliationId,
          rawResponseBody?.reconciliationId,
        )
      : null,
    amount: readNonEmptyString(
      dataAmountDetails?.totalAmount,
      rawAmountDetails?.totalAmount,
    ),
    currency: readNonEmptyString(
      dataAmountDetails?.currency,
      rawAmountDetails?.currency,
    ),
  };
}
