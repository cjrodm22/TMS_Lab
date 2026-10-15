import type { z } from "zod";
import type {
  patchInstrumentIdentifierSchema,
  patchPaymentInstrumentSchema,
  tokenIdParamsSchema,
} from "./tms.schemas.js";

export interface CreateInstrumentIdentifierInput {
  card: {
    number: string;
    expirationMonth?: string;
    expirationYear?: string;
  };
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

export type TokenIdParams = z.infer<typeof tokenIdParamsSchema>;

export type PatchPaymentInstrumentInput = z.infer<
  typeof patchPaymentInstrumentSchema
>;

export type PatchInstrumentIdentifierInput = z.infer<
  typeof patchInstrumentIdentifierSchema
>;
