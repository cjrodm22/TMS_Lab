import type { z } from "zod";
import type {
  captureIdParamsSchema,
  capturePaymentSchema,
  paymentIdParamsSchema,
} from "./payments.schemas.js";

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

export type CapturePaymentInput = z.infer<typeof capturePaymentSchema>;
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
export type CaptureIdParams = z.infer<typeof captureIdParamsSchema>;

export interface CaptureReadinessReason {
  code: string;
  message: string;
}

export interface CaptureReadinessResult {
  paymentId: string;
  eligible: boolean;
  authorizedAmount: string | null;
  capturedAmount: string | null;
  currency: string | null;
  historyVerified: boolean;
  availableAmount: string | null;
  reason: CaptureReadinessReason | null;
}
