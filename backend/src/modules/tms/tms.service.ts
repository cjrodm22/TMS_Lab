import {
  cybersourceRestClient,
  getCybsConfigObject,
} from "../../cybs/cybsClient.js";
import { withTimeout } from "../../utils/withTimeout.js";
import type {
  CreateInstrumentIdentifierInput,
  CreatePaymentInstrumentInput,
} from "./tms.dto.js";
import {
  buildInstrumentIdentifierRequest,
  buildPaymentInstrumentRequest,
  mapInstrumentIdentifierResponse,
  mapPaymentInstrumentResponse,
} from "./tms.mapper.js";

export async function createInstrumentIdentifier(
  payload: CreateInstrumentIdentifierInput,
) {
  if (!payload?.card?.number) {
    throw new Error("card.number is required");
  }

  const apiInstance = new cybersourceRestClient.InstrumentIdentifierApi(
    getCybsConfigObject(),
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

          return resolve(mapInstrumentIdentifierResponse(data, response));
        },
      );
    } catch (error) {
      return reject(error);
    }
  });

  return await withTimeout(cybsRequest, 30000);
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

  const apiInstance = new cybersourceRestClient.PaymentInstrumentApi(
    getCybsConfigObject(),
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

          return resolve(mapPaymentInstrumentResponse(data, response));
        },
      );
    } catch (error) {
      return reject(error);
    }
  });

  return await withTimeout(cybsRequest, 30000);
}
