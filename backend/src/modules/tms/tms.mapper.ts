import { cybsConfig } from "../../config/cybs.config.js";
import { cybersourceRestClient } from "../../cybs/cybsClient.js";
import type {
  CreateInstrumentIdentifierInput,
  CreatePaymentInstrumentInput,
} from "./tms.dto.js";

export function buildInstrumentIdentifierRequest(
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

export function buildPaymentInstrumentRequest(
  payload: CreatePaymentInstrumentInput,
) {
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

function mapResponse(data: any, response: any, sanitized: unknown) {
  return {
    ...(cybsConfig.includeRawResponse && { raw: data }),
    sanitized,
    responseStatus: response?.status,
  };
}

export function mapInstrumentIdentifierResponse(data: any, response: any) {
  return mapResponse(
    data,
    response,
    sanitizeInstrumentIdentifierResponse(data),
  );
}

export function mapPaymentInstrumentResponse(data: any, response: any) {
  return mapResponse(data, response, sanitizePaymentInstrumentResponse(data));
}
