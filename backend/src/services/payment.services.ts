import {
  cybersourceRestClient,
  getCybsConfigObject,
} from "../cybs/cybsClient.js";

export interface CreatePaymentWithPaymentInstrumentInput {
  paymentInstrumentId: string;
  amount: string;
  currency: string;
  referenceCode?: string;
  billTo?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    phoneNumber?: string;
  };
}

function withTimeout<T>(promise: Promise<T>, milliseconds = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`CyberSource request timeout after ${milliseconds}ms`),
        );
      }, milliseconds);
    }),
  ]);
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

function buildPaymentRequest(payload: CreatePaymentWithPaymentInstrumentInput) {
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

export async function createPaymentWithPaymentInstrument(
  payload: CreatePaymentWithPaymentInstrumentInput,
) {
  if (!payload?.paymentInstrumentId) {
    throw new Error("paymentInstrumentId is required");
  }

  if (!payload?.amount) {
    throw new Error("amount is required");
  }

  if (!payload?.currency) {
    throw new Error("currency is required");
  }

  const configObject = getCybsConfigObject();

  const apiInstance = new cybersourceRestClient.PaymentsApi(configObject);

  const requestObj = buildPaymentRequest(payload);

  const cybsRequest = new Promise<any>((resolve, reject) => {
    try {
      apiInstance.createPayment(
        requestObj,
        (error: any, data: any, response: any) => {
          if (error) {
            return reject(error);
          }

          return resolve({
            raw: data,
            sanitized: sanitizePaymentResponse(data),
            responseStatus: response?.status,
          });
        },
      );
    } catch (error) {
      return reject(error);
    }
  });

  return await withTimeout(cybsRequest, 30000);
}
