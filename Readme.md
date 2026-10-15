# cybs-lab

`cybs-lab` is a Node.js and TypeScript backend for building and validating a
CyberSource integration with JWT authentication, Token Management Service
(TMS), and future Message Level Encryption (MLE) support.

## Current validated flow

The following sandbox flow has been validated end to end:

1. Authenticate with CyberSource using JWT and a P12 certificate.
2. Create an Instrument Identifier.
3. Create a Payment Instrument from the Instrument Identifier.
4. Authorize a payment using the Payment Instrument.

The implementation intentionally keeps the CyberSource SDK callback patterns
that are known to work with this project.

## CyberSource environments

- Sandbox: `apitest.cybersource.com`
- Production: `api.cybersource.com`

Use sandbox credentials and certificates while developing. Switching the host
alone is not sufficient for production: production credentials and a production
certificate are also required.

## Security

- Never commit `.env` files.
- Never commit the `certs/` directory.
- Never commit `.p12`, `.pem`, `.key`, or `.crt` files.
- Never log PAN, CVV, certificate passwords, JWTs, secrets, or private key data.
- Use only synthetic CyberSource test card data in the sandbox.

The repository `.gitignore` excludes these sensitive local files, but each
developer is still responsible for checking changes before committing them.

## Required local files

The backend expects these files to exist locally:

```text
backend/.env
backend/certs/<certificate>.p12
```

Create `backend/.env` from `backend/.env.example` and provide your own sandbox
values. A safe template is:

```dotenv
PORT=3001
NODE_ENV=development

CYBS_RUN_ENVIRONMENT=apitest.cybersource.com
CYBS_MERCHANT_ID=

CYBS_AUTHENTICATION_TYPE=jwt
CYBS_KEYS_DIRECTORY=./certs
CYBS_KEY_FILE_NAME=
CYBS_KEY_PASS=
CYBS_KEY_ALIAS=

CYBS_ENABLE_LOG=false
CYBS_ALLOW_PRODUCTION_CAPTURES=false
```

All paths are resolved from the directory where the backend process starts, so
run the application from `backend/`.

## Install and run

```bash
cd backend
npm install
npm run dev
```

Available scripts:

- `npm run dev` starts the TypeScript development server in watch mode.
- `npm run build` compiles the backend into `backend/dist/`.
- `npm run start` runs the compiled server.
- `npm run test` runs the unit tests with Vitest. The CyberSource SDK is mocked;
  the tests do not call the CyberSource API.

The default local base URL is `http://localhost:3001`.

## API endpoints

### Health

```http
GET /health
```

### CyberSource configuration summary

```http
GET /api/config/cybs
```

This endpoint is intended for the lab environment. It does not return the P12
password or private key data.

### Create an Instrument Identifier

```http
POST /api/tms/instrument-identifiers
Content-Type: application/json
```

```json
{
  "card": {
    "number": "<sandbox-test-pan>",
    "expirationMonth": "12",
    "expirationYear": "2031"
  }
}
```

`card.number` is required. Expiration fields are optional for this request.

### Create a Payment Instrument

```http
POST /api/tms/payment-instruments
Content-Type: application/json
```

```json
{
  "instrumentIdentifierId": "<instrument-identifier-id>",
  "card": {
    "expirationMonth": "12",
    "expirationYear": "2031",
    "type": "001"
  },
  "billTo": {
    "firstName": "Test",
    "lastName": "Customer",
    "address1": "1 Test Street",
    "locality": "Test City",
    "administrativeArea": "CA",
    "postalCode": "94105",
    "country": "US",
    "email": "test@example.com",
    "phoneNumber": "5550100000"
  }
}
```

`instrumentIdentifierId`, `card.expirationMonth`, and `card.expirationYear` are
required. `billTo` is optional.

### Retrieve an Instrument Identifier

```http
GET /api/tms/instrument-identifiers/<instrument-identifier-id>
```

Example response structure:

```json
{
  "success": true,
  "message": "Instrument Identifier retrieved successfully",
  "data": {
    "sanitized": {
      "id": "<instrument-identifier-id>",
      "object": "instrumentIdentifier",
      "state": "ACTIVE",
      "card": {
        "number": "****1111"
      }
    },
    "responseStatus": 200
  }
}
```

Card numbers are never returned unmasked by this endpoint.

### Retrieve a Payment Instrument

```http
GET /api/tms/payment-instruments/<payment-instrument-id>
```

Example response structure:

```json
{
  "success": true,
  "message": "Payment Instrument retrieved successfully",
  "data": {
    "sanitized": {
      "id": "<payment-instrument-id>",
      "object": "paymentInstrument",
      "state": "ACTIVE",
      "instrumentIdentifier": {
        "id": "<instrument-identifier-id>"
      },
      "card": {
        "expirationMonth": "12",
        "expirationYear": "2031",
        "type": "001"
      },
      "billTo": {
        "firstName": "Test",
        "lastName": "Customer",
        "country": "US"
      }
    },
    "responseStatus": 200
  }
}
```

### List Payment Instruments for an Instrument Identifier

```http
GET /api/tms/instrument-identifiers/<instrument-identifier-id>/payment-instruments
```

Example response structure:

```json
{
  "success": true,
  "message": "Payment Instruments retrieved successfully",
  "data": {
    "sanitized": {
      "offset": 0,
      "limit": 20,
      "count": 1,
      "total": 1,
      "paymentInstruments": [
        {
          "id": "<payment-instrument-id>",
          "object": "paymentInstrument",
          "state": "ACTIVE"
        }
      ]
    },
    "responseStatus": 200
  }
}
```

### Update a Payment Instrument

```http
PATCH /api/tms/payment-instruments/<payment-instrument-id>
Content-Type: application/json
```

```json
{
  "card": {
    "expirationMonth": "12",
    "expirationYear": "2032"
  },
  "billTo": {
    "firstName": "Updated",
    "lastName": "Customer",
    "company": "Example Company",
    "address1": "2 Test Street",
    "address2": "Unit B",
    "locality": "Test City",
    "administrativeArea": "CA",
    "postalCode": "94105",
    "country": "US",
    "email": "updated@example.com",
    "phoneNumber": "5550100001"
  }
}
```

Supported fields are `card.expirationMonth`, `card.expirationYear`, and these
`billTo` fields: `firstName`, `lastName`, `company`, `address1`, `address2`,
`locality`, `administrativeArea`, `postalCode`, `country`, `email`, and
`phoneNumber`.

### Update an Instrument Identifier

```http
PATCH /api/tms/instrument-identifiers/<instrument-identifier-id>
Content-Type: application/json
```

```json
{
  "card": {
    "expirationMonth": "12",
    "expirationYear": "2032"
  },
  "billTo": {
    "address1": "2 Test Street",
    "address2": "Unit B",
    "locality": "Test City",
    "administrativeArea": "CA",
    "postalCode": "94105",
    "country": "US"
  }
}
```

Supported fields are `card.expirationMonth`, `card.expirationYear`, and these
CyberSource-documented Instrument Identifier address fields: `billTo.address1`,
`billTo.address2`, `billTo.locality`, `billTo.administrativeArea`,
`billTo.postalCode`, and `billTo.country`.

PATCH bodies must be non-empty. Month values use `MM` from `01` through `12`,
and year values use four-digit `YYYY`. Unknown properties are rejected. These
endpoints intentionally do not accept token IDs in the body, PAN replacement,
security codes, bank-account replacement, state, links, metadata, embedded
objects, or other SDK response fields. The token ID remains the ID in the URL.

Successful GET and PATCH responses contain only the allowlisted `sanitized`
object and HTTP `responseStatus`; they never include the raw SDK response.

### Instrument Identifier versus Payment Instrument

An **Instrument Identifier** represents the underlying payment account identity,
such as the tokenized PAN. Multiple Payment Instruments can refer to the same
Instrument Identifier. A **Payment Instrument** represents the reusable payment
details used for a transaction, including the expiration date and billing
information. Use the Instrument Identifier ID to group account-level tokens and
the Payment Instrument ID when authorizing the existing payment flow.

### Authorize a payment using a Payment Instrument

```http
POST /api/tms/payments/payment-instrument
Content-Type: application/json
```

```json
{
  "paymentInstrumentId": "<payment-instrument-id>",
  "amount": "10.00",
  "currency": "USD",
  "referenceCode": "LAB-ORDER-001",
  "billTo": {
    "firstName": "Test",
    "lastName": "Customer",
    "address1": "1 Test Street",
    "locality": "Test City",
    "administrativeArea": "CA",
    "postalCode": "94105",
    "country": "US",
    "email": "test@example.com",
    "phoneNumber": "5550100000"
  }
}
```

`paymentInstrumentId`, `amount`, and `currency` are required. The current
operation authorizes without capture. The authorization mapper continues to set
`processingInformation.capture` to `false`; creating an authorization never
submits a capture automatically.

### Authorization versus capture

Authorization verifies the payment method and reserves funds. Capture is a
separate action that asks CyberSource to move an authorized amount toward
settlement. Use the payment ID returned by the successful authorization—not the
Payment Instrument ID—as the `paymentId` in the capture URL.

The amount fields have different meanings. An authorization is evaluated from
`orderInformation.amountDetails.authorizedAmount`. Each related capture is
counted from `orderInformation.amountDetails.totalAmount`. The service does not
use a settlement or converted billing amount as the capture amount.

### Check capture readiness

```http
GET /api/payments/<payment-id>/capture-readiness
```

This is a read-only preflight check. It calls only CyberSource Transaction
Details and does not authorize, capture, reserve funds, retry an operation,
clear an unknown attempt, or mutate local capture state.

Example eligible response:

```json
{
  "success": true,
  "message": "Capture readiness evaluated successfully",
  "data": {
    "paymentId": "<payment-id>",
    "eligible": true,
    "authorizedAmount": "10.00",
    "capturedAmount": "3.00",
    "currency": "USD",
    "historyVerified": true,
    "availableAmount": "7.00",
    "reason": null
  }
}
```

An ineligible result is also an HTTP `200` because the assessment completed
successfully. In that case `eligible` is `false` and `reason` contains only a
safe `code` and `message`. Amounts or currency that could not be verified are
returned as `null`. Common reason codes include:

- `AUTHORIZATION_CONTEXT_MISSING`: this process did not create the
  authorization, including after a restart.
- `AUTHORIZATION_NOT_VISIBLE`: Transaction Details does not yet expose the
  authorization.
- `AUTHORIZATION_NOT_CAPTURE_ELIGIBLE` or
  `AUTHORIZATION_STATUS_AMBIGUOUS`: authorization or reversal applications do
  not establish an approved, unreversed authorization.
- `CAPTURE_HISTORY_UNVERIFIED`: related history, an amount, a currency, a root
  payment ID, or application outcome is missing, conflicting, or ambiguous.
- `CAPTURE_HISTORY_NOT_SYNCHRONIZED`: a locally accepted capture is not yet in
  the Transaction Details related links.
- `CAPTURE_RECONCILIATION_PENDING`: a related capture is accepted or pending
  but not yet in a completed capture state.
- `CAPTURE_OUTCOME_UNKNOWN` or `CAPTURE_IN_PROGRESS`: this process has an
  ambiguous or concurrent capture attempt.
- `CAPTURE_CURRENCY_MISMATCH` or `PAYMENT_ALREADY_FULLY_CAPTURED`: the verified
  related data leaves no safe matching amount to capture.

An explicit empty `relatedTransactions` array is a valid point-in-time empty
snapshot. A missing array is not equivalent and fails closed. Completed partial
captures are summed exactly; an accepted or pending capture is included in the
captured total but makes the payment ineligible until reconciliation. Every
relevant application is classified, so the service does not accept the first
matching application when multiple capture or authorization applications
conflict.

`eligible: true` is only a point-in-time preflight result. The actual production
capture repeats the same authoritative assessment immediately before SDK
submission and may still reject if the state changed. `historyVerified: true`
means that the explicit related-link snapshot and every relevant returned
record passed these checks; it does not prove that reporting is instantaneous
or that the snapshot is exhaustive.

### Capture an authorized payment

```http
POST /api/payments/<payment-id>/captures
Content-Type: application/json
```

```json
{
  "amount": "10.00",
  "currency": "USD",
  "referenceCode": "CAPTURE-LAB-ORDER-001"
}
```

`amount` must be a positive decimal string, `currency` must be an uppercase ISO
4217 currency code, and `referenceCode` must be non-empty. Use a unique and
stable reference code for each intended capture.

Example response structure:

```json
{
  "success": true,
  "message": "Payment capture submitted successfully",
  "data": {
    "sanitized": {
      "captureId": "<capture-id>",
      "status": "PENDING",
      "paymentId": "<payment-id>",
      "amount": "10.00",
      "currency": "USD",
      "submitTimeUtc": "2026-10-14T18:00:00Z",
      "reconciliationId": "<processor-reconciliation-id>"
    },
    "responseStatus": 201
  }
}
```

`reconciliationId` can be `null` when the processor does not return it. A
successful submission is commonly `PENDING`: this confirms that CyberSource
accepted the capture request for processing, not that settlement has completed.
Only an authoritative later transaction status or bank reconciliation can
confirm settlement.

### Retrieve capture status

```http
GET /api/payments/captures/<capture-id>
```

The installed `cybersource-rest-client@0.0.26` package does not generate a GET
method on `CaptureApi`, even though successful capture responses can contain a
`self` link for `/pts/v2/captures/{captureId}`. This endpoint therefore uses the
supported SDK method
`TransactionDetailsApi.getTransaction(captureId, callback)`, which calls
`GET /tss/v2/transactions/{id}`.

Transaction Details can return several application results for one record. The
mapper accepts capture status only from a capture application (`ics_bill` for
card settlement or `ics_ap_capture` for alternative payments). It does not use
an `ics_auth` result as capture status. The installed model names the top-level
submission field `submitTimeUTC`; the mapper also reads the documented
`submitTimeUtc` spelling from the SDK callback response body because this SDK
version can otherwise discard that value during model conversion.

The sanitized lookup includes `captureId`, `paymentId`, `status`,
`submitTimeUtc`, `reconciliationId`, `amount`, `currency`, and the surrounding
`responseStatus`. Unavailable values are returned as `null`. `null` and
`PENDING` never mean settled. Status values are returned without translating
them to `SETTLED`; consider settlement confirmed only when an authoritative
CyberSource transaction status and the processor or bank reconciliation agree.

### Capture production safety and duplicate handling

Captures remain disabled when `NODE_ENV=production` or the CyberSource host is
not a sandbox host unless the deployment explicitly sets:

```dotenv
CYBS_ALLOW_PRODUCTION_CAPTURES=true
```

Leave this value `false` for local development and until production capture
access has been deliberately approved. The flag does not replace normal API
authentication and authorization at the application boundary.

The current controlled-pilot guard also requires all of the following before a
production capture is submitted:

- The authorization was created successfully by the same running backend
  process. Missing state after a restart fails with
  `AUTHORIZATION_CONTEXT_MISSING`.
- `TransactionDetailsApi.getTransaction(paymentId, callback)` confirms an
  approved `ics_auth` or `ics_ap_auth` result and supplies the authorized amount
  and currency.
- CyberSource supplies `_links.relatedTransactions` as an array. Every related
  transaction is inspected, completed and pending captures are included in the
  used amount, pending captures block a new capture, and accepted authorization
  reversals make the payment ineligible.
- The capture currency matches, the requested amount does not exceed the
  verified available authorization, and the authorization has not already been
  fully captured.

If the related-transaction list, a related capture amount, its currency, its
root payment ID, or its outcome cannot be verified, production capture fails
closed with `CAPTURE_HISTORY_UNVERIFIED`. An absent list is not treated as an
empty list. This is an intentional blocker: the service does not infer a safe
available balance from the original authorization alone.

Transaction Details and Transaction Search are reporting systems and may lag
behind a successful payment operation. The installed SDK's documented
Transaction Search filters do not include an authorization `rootId`, so this
implementation does not use a broad search result to claim that capture history
is exhaustive. When a locally accepted capture is absent from the current
related-link snapshot, the service returns
`CAPTURE_HISTORY_NOT_SYNCHRONIZED` and requires later reconciliation.

Within one running backend process, the service retains the exact
`paymentId` plus `referenceCode` duplicate check. It also rejects overlapping
captures for the same `paymentId` even when reference codes differ. Once an
attempt has an unknown outcome, every later capture for that payment is blocked
until an operator reconciles it. Confirmed captures retain their authorization
reservation; only a definitive rejection represented by the installed SDK's
documented capture-error model releases it.

Network interruption, connection reset, local or HTTP-client timeout,
unexpected SDK response, response-mapping failure after submission, and an
unclassified server or 4xx error are treated as ambiguous. The API returns the
safe code `CAPTURE_OUTCOME_UNKNOWN`, keeps the amount reserved, retains the
attempt as `UNKNOWN`, and never retries automatically. A `DUPLICATE_REQUEST`
response is also treated as unknown because it can indicate a prior accepted
submission. Only documented, definitive 400 reasons such as `MISSING_FIELD`,
`INVALID_DATA`, `INVALID_AMOUNT`, `EXCEEDS_AUTH_AMOUNT`, `MISSING_AUTH`, or an
already-reversed/settled authorization release the reservation.

Before any manual retry after `CAPTURE_OUTCOME_UNKNOWN`:

1. Search CyberSource Transaction Search using the exact capture
   `referenceCode` and a narrow submission-time window.
2. If a capture ID is found, query
   `GET /api/payments/captures/{captureId}` and inspect its capture application.
3. Confirm the result in the CyberSource Business Center and processor or bank
   reconciliation. Do not interpret an absent search result immediately after
   submission as proof that no capture occurred; reporting data can lag.
4. Retry only after an operator has authoritative evidence that CyberSource did
   not accept the original request. This version intentionally provides no
   automatic retry or API that clears an unknown attempt.

These safeguards remain process-local and are **not durable idempotency**. A
restart loses authorization, reservation, and attempt state and therefore
blocks captures for pre-restart authorizations rather than attempting to
reconstruct permission. Multiple backend instances do not share locks. A
durable store with transactional payment-level locking and unique idempotency
keys is still required before general production use.

For the controlled production pilot, keep one backend instance, create the
authorization and capture within the same process lifetime, retain the explicit
production opt-in, verify that the merchant's Transaction Details response
actually includes authoritative `relatedTransactions`, and have a manual
reconciliation operator available. If CyberSource omits that field for the
merchant or processor, this implementation deliberately blocks the production
capture; do not bypass the check by changing reference codes.

The existing create and payment responses retain their current lab behavior: they
contain a sanitized representation and, when `NODE_ENV` is not `production`, the
raw CyberSource SDK response. Raw data remains disabled in production. The new
GET and PATCH operations are always sanitized as described above.

## Successful sandbox evidence

The current integration has produced these non-sensitive results:

- Instrument Identifier created with state `ACTIVE`.
- Payment Instrument created with state `ACTIVE`.
- Payment using the Payment Instrument returned `AUTHORIZED`.
- Processor response code: `00`.

No identifiers, card data, credentials, or certificate details are recorded in
this document.

## Project structure

```text
backend/src/
├── config/       CyberSource environment configuration
├── cybs/         CyberSource SDK access
├── middlewares/  Shared Express middleware
├── modules/
│   ├── payments/ Payment authorization and capture flows
│   └── tms/      Instrument and Payment Instrument flows
├── routes/       API route composition
├── types/        Third-party TypeScript declarations
├── utils/        Shared helpers
└── server.ts     Express application entry point
```

## Roadmap

- Add MLE.
- Add standard payments with JWT.
- Add reversals and voids.
- Add refunds.
- Add invoices.
- Add unit tests.
- Add database persistence.
- Add a frontend.
