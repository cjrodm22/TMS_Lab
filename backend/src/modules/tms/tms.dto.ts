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
