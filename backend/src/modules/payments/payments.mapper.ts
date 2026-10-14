import { cybsConfig } from "../../config/cybs.config.js";
import { cybersourceRestClient } from "../../cybs/cybsClient.js";
import type { CreatePaymentWithPaymentInstrumentInput } from "./payments.dto.js";

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
      phoneNumber: payload.billTo?.phoneNumber || "50588888888",
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

export function mapPaymentResponse(data: any, response: any) {
  return {
    ...(cybsConfig.includeRawResponse && { raw: data }),
    sanitized: sanitizePaymentResponse(data),
    responseStatus: response?.status,
  };
}
