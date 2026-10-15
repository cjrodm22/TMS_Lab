import { cybsConfig } from "../../config/cybs.config.js";
import { cybersourceRestClient } from "../../cybs/cybsClient.js";
import type {
  CreateInstrumentIdentifierInput,
  CreatePaymentInstrumentInput,
  PatchInstrumentIdentifierInput,
  PatchPaymentInstrumentInput,
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

export function buildPatchPaymentInstrumentRequest(
  payload: PatchPaymentInstrumentInput,
) {
  const requestObj = new cybersourceRestClient.PatchPaymentInstrumentRequest();

  if (payload.card) {
    requestObj.card = { ...payload.card };
  }

  if (payload.billTo) {
    requestObj.billTo = { ...payload.billTo };
  }

  return requestObj;
}

export function buildPatchInstrumentIdentifierRequest(
  payload: PatchInstrumentIdentifierInput,
) {
  const requestObj =
    new cybersourceRestClient.PatchInstrumentIdentifierRequest();

  if (payload.card) {
    requestObj.card = { ...payload.card };
  }

  if (payload.billTo) {
    requestObj.billTo = { ...payload.billTo };
  }

  return requestObj;
}

function maskCardNumber(number: unknown): string | undefined {
  if (typeof number !== "string") {
    return undefined;
  }

  const digits = number.replace(/\D/g, "");
  return digits.length >= 4 ? `****${digits.slice(-4)}` : undefined;
}

function sanitizeBillTo(data: any) {
  if (!data) {
    return undefined;
  }

  return {
    firstName: data.firstName,
    lastName: data.lastName,
    company: data.company,
    address1: data.address1,
    address2: data.address2,
    locality: data.locality,
    administrativeArea: data.administrativeArea,
    postalCode: data.postalCode,
    country: data.country,
    email: data.email,
    phoneNumber: data.phoneNumber,
  };
}

function sanitizeLinks(data: any) {
  if (!data) {
    return undefined;
  }

  return {
    self: data.self?.href ? { href: data.self.href } : undefined,
    paymentInstruments: data.paymentInstruments?.href
      ? { href: data.paymentInstruments.href }
      : undefined,
  };
}

export function sanitizeInstrumentIdentifierResponse(data: any) {
  return {
    id: data?.id,
    object: data?.object,
    state: data?.state,
    type: data?.type,
    card: {
      number: maskCardNumber(data?.card?.number),
      expirationMonth: data?.card?.expirationMonth,
      expirationYear: data?.card?.expirationYear,
      type: data?.card?.type,
    },
    issuer: data?.issuer?.paymentAccountReference
      ? { paymentAccountReference: data.issuer.paymentAccountReference }
      : undefined,
    billTo: sanitizeBillTo(data?.billTo),
    metadata: data?.metadata?.creator
      ? { creator: data.metadata.creator }
      : undefined,
    links: sanitizeLinks(data?._links),
  };
}

export function sanitizePaymentInstrumentResponse(data: any) {
  return {
    id: data?.id,
    object: data?.object,
    state: data?.state,
    instrumentIdentifier: data?.instrumentIdentifier?.id
      ? { id: data.instrumentIdentifier.id }
      : undefined,
    card: {
      expirationMonth: data?.card?.expirationMonth,
      expirationYear: data?.card?.expirationYear,
      type: data?.card?.type,
    },
    billTo: sanitizeBillTo(data?.billTo),
    metadata: data?.metadata?.creator
      ? { creator: data.metadata.creator }
      : undefined,
    links: sanitizeLinks(data?._links),
  };
}

export function sanitizePaymentInstrumentListResponse(data: any) {
  const paymentInstruments = Array.isArray(
    data?._embedded?.paymentInstruments,
  )
    ? data._embedded.paymentInstruments
    : [];

  return {
    offset: data?.offset,
    limit: data?.limit,
    count: data?.count,
    total: data?.total,
    paymentInstruments: paymentInstruments.map(
      sanitizePaymentInstrumentResponse,
    ),
  };
}

function mapResponse(
  data: any,
  response: any,
  sanitized: unknown,
  includeRawResponse: boolean,
) {
  return {
    ...(includeRawResponse && { raw: data }),
    sanitized,
    responseStatus: response?.status,
  };
}

export function mapInstrumentIdentifierResponse(
  data: any,
  response: any,
  includeRawResponse = cybsConfig.includeRawResponse,
) {
  return mapResponse(
    data,
    response,
    sanitizeInstrumentIdentifierResponse(data),
    includeRawResponse,
  );
}

export function mapPaymentInstrumentResponse(
  data: any,
  response: any,
  includeRawResponse = cybsConfig.includeRawResponse,
) {
  return mapResponse(
    data,
    response,
    sanitizePaymentInstrumentResponse(data),
    includeRawResponse,
  );
}

export function mapPaymentInstrumentListResponse(data: any, response: any) {
  return mapResponse(
    data,
    response,
    sanitizePaymentInstrumentListResponse(data),
    false,
  );
}
