import {
  cybersourceRestClient,
  getCybsConfigObject,
} from "../../cybs/cybsClient.js";
import { withTimeout } from "../../utils/withTimeout.js";
import type { CreatePaymentWithPaymentInstrumentInput } from "./payments.dto.js";
import {
  buildPaymentRequest,
  mapPaymentResponse,
} from "./payments.mapper.js";

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

  const apiInstance = new cybersourceRestClient.PaymentsApi(
    getCybsConfigObject(),
  );
  const requestObj = buildPaymentRequest(payload);

  const cybsRequest = new Promise<any>((resolve, reject) => {
    try {
      apiInstance.createPayment(
        requestObj,
        (error: any, data: any, response: any) => {
          if (error) {
            return reject(error);
          }

          return resolve(mapPaymentResponse(data, response));
        },
      );
    } catch (error) {
      return reject(error);
    }
  });

  return await withTimeout(cybsRequest, 30000);
}
