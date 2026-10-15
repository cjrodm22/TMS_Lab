import {
  cybersourceRestClient,
  getCybsConfigObject,
} from "../../cybs/cybsClient.js";
import { withTimeout } from "../../utils/withTimeout.js";
import {
  AppError,
  normalizeCybersourceError,
} from "../../utils/appError.js";
import type {
  CreateInstrumentIdentifierInput,
  CreatePaymentInstrumentInput,
  PatchInstrumentIdentifierInput,
  PatchPaymentInstrumentInput,
} from "./tms.dto.js";
import {
  buildInstrumentIdentifierRequest,
  buildPatchInstrumentIdentifierRequest,
  buildPatchPaymentInstrumentRequest,
  buildPaymentInstrumentRequest,
  mapInstrumentIdentifierResponse,
  mapPaymentInstrumentListResponse,
  mapPaymentInstrumentResponse,
} from "./tms.mapper.js";

type SdkCallback = (error: any, data: any, response: any) => void;

async function runSdkCall<T>(
  invoke: (callback: SdkCallback) => void,
  mapResult: (data: any, response: any) => T,
): Promise<T> {
  const cybsRequest = new Promise<T>((resolve, reject) => {
    const callback: SdkCallback = (error, data, response) => {
      if (error) {
        reject(normalizeCybersourceError(error));
        return;
      }

      try {
        resolve(mapResult(data, response));
      } catch (mappingError) {
        reject(mappingError);
      }
    };

    try {
      invoke(callback);
    } catch (error) {
      reject(normalizeCybersourceError(error));
    }
  });

  return await withTimeout(cybsRequest, 30000);
}

function requireTokenId(tokenId: string, tokenName: string): string {
  if (!tokenId?.trim()) {
    throw new AppError(`${tokenName} token ID is required`, {
      statusCode: 400,
      code: "MISSING_TOKEN_ID",
    });
  }

  return tokenId;
}

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

  return await runSdkCall(
    (callback) => apiInstance.postInstrumentIdentifier(requestObj, {}, callback),
    mapInstrumentIdentifierResponse,
  );
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

  return await runSdkCall(
    (callback) => apiInstance.postPaymentInstrument(requestObj, {}, callback),
    mapPaymentInstrumentResponse,
  );
}

export async function getInstrumentIdentifier(tokenId: string) {
  const validatedTokenId = requireTokenId(tokenId, "Instrument Identifier");
  const apiInstance = new cybersourceRestClient.InstrumentIdentifierApi(
    getCybsConfigObject(),
  );

  return await runSdkCall(
    (callback) =>
      apiInstance.getInstrumentIdentifier(validatedTokenId, {}, callback),
    (data, response) => mapInstrumentIdentifierResponse(data, response, false),
  );
}

export async function getPaymentInstrument(tokenId: string) {
  const validatedTokenId = requireTokenId(tokenId, "Payment Instrument");
  const apiInstance = new cybersourceRestClient.PaymentInstrumentApi(
    getCybsConfigObject(),
  );

  return await runSdkCall(
    (callback) =>
      apiInstance.getPaymentInstrument(validatedTokenId, {}, callback),
    (data, response) => mapPaymentInstrumentResponse(data, response, false),
  );
}

export async function listPaymentInstrumentsForInstrumentIdentifier(
  tokenId: string,
) {
  const validatedTokenId = requireTokenId(tokenId, "Instrument Identifier");
  const apiInstance = new cybersourceRestClient.InstrumentIdentifierApi(
    getCybsConfigObject(),
  );

  return await runSdkCall(
    (callback) =>
      apiInstance.getInstrumentIdentifierPaymentInstrumentsList(
        validatedTokenId,
        {},
        callback,
      ),
    mapPaymentInstrumentListResponse,
  );
}

export async function updatePaymentInstrument(
  tokenId: string,
  payload: PatchPaymentInstrumentInput,
) {
  const validatedTokenId = requireTokenId(tokenId, "Payment Instrument");
  const apiInstance = new cybersourceRestClient.PaymentInstrumentApi(
    getCybsConfigObject(),
  );
  const requestObj = buildPatchPaymentInstrumentRequest(payload);

  return await runSdkCall(
    (callback) =>
      apiInstance.patchPaymentInstrument(
        validatedTokenId,
        requestObj,
        {},
        callback,
      ),
    (data, response) => mapPaymentInstrumentResponse(data, response, false),
  );
}

export async function updateInstrumentIdentifier(
  tokenId: string,
  payload: PatchInstrumentIdentifierInput,
) {
  const validatedTokenId = requireTokenId(tokenId, "Instrument Identifier");
  const apiInstance = new cybersourceRestClient.InstrumentIdentifierApi(
    getCybsConfigObject(),
  );
  const requestObj = buildPatchInstrumentIdentifierRequest(payload);

  return await runSdkCall(
    (callback) =>
      apiInstance.patchInstrumentIdentifier(
        validatedTokenId,
        requestObj,
        {},
        callback,
      ),
    (data, response) => mapInstrumentIdentifierResponse(data, response, false),
  );
}
