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
