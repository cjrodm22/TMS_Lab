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
