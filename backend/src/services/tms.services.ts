import {
  cybersourceRestClient,
  getCybsConfigObject,
} from "../cybs/cybsClient.js";

export interface CreateInstrumentIdentifierInput {
  card: {
    number: string;
    expirationMonth?: string;
    expirationYear?: string;
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

function sanitizeInstrumentIdentifierResponse(data: any) {
  return {
    id: data?.id,
    object: data?.object,
    state: data?.state,
    card: {
      number: data?.card?.number,
      expirationMonth: data?.card?.expirationMonth,
      expirationYear: data?.card?.expirationYear,
      type: data?.card?.type,
    },
    issuer: {
      paymentAccountReference: data?.issuer?.paymentAccountReference,
    },
    metadata: data?.metadata,
    links: data?._links,
  };
}

function buildInstrumentIdentifierRequest(
  payload: CreateInstrumentIdentifierInput,
) {
  const requestObj =
    new cybersourceRestClient.PostInstrumentIdentifierRequest();

  requestObj.card = {
    number: payload.card.number,
    ...(payload.card.expirationMonth && {
      expirationMonth: payload.card.expirationMonth,
    }),
    ...(payload.card.expirationYear && {
      expirationYear: payload.card.expirationYear,
    }),
  };

  return requestObj;
}

export async function createInstrumentIdentifier(
  payload: CreateInstrumentIdentifierInput,
) {
  if (!payload?.card?.number) {
    throw new Error("card.number is required");
  }

  const configObject = getCybsConfigObject();

  const apiInstance = new cybersourceRestClient.InstrumentIdentifierApi(
    configObject,
  );

  const requestObj = buildInstrumentIdentifierRequest(payload);

  const cybsRequest = new Promise<any>((resolve, reject) => {
    try {
      apiInstance.postInstrumentIdentifier(
        requestObj,
        {},
        (error: any, data: any, response: any) => {
          if (error) {
            return reject(error);
          }

          return resolve({
            raw: data,
            sanitized: sanitizeInstrumentIdentifierResponse(data),
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

export interface CreatePaymentInstrumentInput {
  instrumentIdentifierId: string;
  card: {
    expirationMonth: string;
    expirationYear: string;
    type?: string;
  };
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

function sanitizePaymentInstrumentResponse(data: any) {
  return {
    id: data?.id,
    object: data?.object,
    state: data?.state,
    instrumentIdentifier: data?.instrumentIdentifier,
    card: {
      expirationMonth: data?.card?.expirationMonth,
      expirationYear: data?.card?.expirationYear,
      type: data?.card?.type,
    },
    billTo: data?.billTo,
    metadata: data?.metadata,
    links: data?._links,
  };
}

function buildPaymentInstrumentRequest(payload: CreatePaymentInstrumentInput) {
  const requestObj = new cybersourceRestClient.PostPaymentInstrumentRequest();

  requestObj.instrumentIdentifier = {
    id: payload.instrumentIdentifierId,
  };

  requestObj.card = {
    expirationMonth: payload.card.expirationMonth,
    expirationYear: payload.card.expirationYear,
  };

  if (payload.billTo) {
    requestObj.billTo = {
      ...(payload.billTo.firstName && { firstName: payload.billTo.firstName }),
      ...(payload.billTo.lastName && { lastName: payload.billTo.lastName }),
      ...(payload.billTo.address1 && { address1: payload.billTo.address1 }),
      ...(payload.billTo.locality && { locality: payload.billTo.locality }),
      ...(payload.billTo.administrativeArea && {
        administrativeArea: payload.billTo.administrativeArea,
      }),
      ...(payload.billTo.postalCode && {
        postalCode: payload.billTo.postalCode,
      }),
      ...(payload.billTo.country && { country: payload.billTo.country }),
      ...(payload.billTo.email && { email: payload.billTo.email }),
      ...(payload.billTo.phoneNumber && {
        phoneNumber: payload.billTo.phoneNumber,
      }),
    };
  }

  return requestObj;
}

export async function createPaymentInstrument(
  payload: CreatePaymentInstrumentInput,
) {
  if (!payload?.instrumentIdentifierId) {
    throw new Error("instrumentIdentifierId is required");
  }

  if (!payload?.card?.expirationMonth) {
    throw new Error("card.expirationMonth is required");
  }

  if (!payload?.card?.expirationYear) {
    throw new Error("card.expirationYear is required");
  }

  const configObject = getCybsConfigObject();

  const apiInstance = new cybersourceRestClient.PaymentInstrumentApi(
    configObject,
  );

  const requestObj = buildPaymentInstrumentRequest(payload);

  const cybsRequest = new Promise<any>((resolve, reject) => {
    try {
      apiInstance.postPaymentInstrument(
        requestObj,
        {},
        (error: any, data: any, response: any) => {
          if (error) {
            return reject(error);
          }

          return resolve({
            raw: data,
            sanitized: sanitizePaymentInstrumentResponse(data),
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
