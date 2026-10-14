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
operation authorizes without capture.

Successful lab responses contain a sanitized representation and, when
`NODE_ENV` is not `production`, the raw CyberSource SDK response. This keeps the
sandbox useful for inspection while allowing raw data to be disabled in
production.

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
│   ├── payments/ Payment authorization flow
│   └── tms/      Instrument and Payment Instrument flows
├── routes/       API route composition
├── types/        Third-party TypeScript declarations
├── utils/        Shared helpers
└── server.ts     Express application entry point
```

## Roadmap

- Add MLE.
- Add standard payments with JWT.
- Add captures.
- Add reversals and voids.
- Add refunds.
- Add invoices.
- Add unit tests.
- Add database persistence.
- Add a frontend.
