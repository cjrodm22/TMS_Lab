import {
  cybersourceRestClient,
  getCybsConfigObject,
} from "../../cybs/cybsClient.js";
import { cybsConfig } from "../../config/cybs.config.js";
import { AppError, normalizeCybersourceError } from "../../utils/appError.js";
import { withTimeout } from "../../utils/withTimeout.js";
import type {
  CaptureReadinessResult,
  CapturePaymentInput,
  CreatePaymentWithPaymentInstrumentInput,
} from "./payments.dto.js";
import {
  buildPaymentRequest,
  buildCapturePaymentRequest,
  mapCaptureResponse,
  mapCaptureStatusResponse,
  mapPaymentResponse,
} from "./payments.mapper.js";

interface AuthorizationRecord {
  amountUnits: bigint;
  reservedUnits: bigint;
  currency: string;
}

interface CaptureAttempt {
  paymentId: string;
  referenceCode: string;
  amountUnits: bigint;
  state: "IN_FLIGHT" | "COMPLETED" | "UNKNOWN";
  captureId?: string;
}

type ApplicationOutcome =
  | "NONE"
  | "ACCEPTED"
  | "REJECTED"
  | "PENDING"
  | "AMBIGUOUS";

interface CaptureSafetyReason {
  code: string;
  message: string;
  statusCode: number;
}

interface CaptureSafetyAssessment {
  paymentId: string;
  eligible: boolean;
  authorizedAmountUnits?: bigint;
  capturedAmountUnits?: bigint;
  availableAmountUnits?: bigint;
  currency?: string;
  historyVerified: boolean;
  reason?: CaptureSafetyReason;
}

const authorizationRecords = new Map<string, AuthorizationRecord>();
const captureAttempts = new Map<string, CaptureAttempt>();

const definitiveCaptureRejectionReasons = new Set([
  "MISSING_FIELD",
  "INVALID_DATA",
  "INVALID_MERCHANT_CONFIGURATION",
  "EXCEEDS_AUTH_AMOUNT",
  "AUTH_ALREADY_REVERSED",
  "TRANSACTION_ALREADY_SETTLED",
  "INVALID_AMOUNT",
  "MISSING_AUTH",
  "TRANSACTION_ALREADY_REVERSED_OR_SETTLED",
]);

const captureApplicationNames = new Set(["ics_bill", "ics_ap_capture"]);
const authorizationApplicationNames = new Set(["ics_auth", "ics_ap_auth"]);
const authorizationReversalApplicationNames = new Set([
  "ics_auth_reversal",
  "ics_auto_auth_reversal",
  "ics_auto_full_auth_reversal",
]);
const pendingCaptureStatuses = new Set([
  "ACCEPTED",
  "PENDING",
  "TRANSMITTED",
]);
const completedCaptureStatuses = new Set([
  "CAPTURED",
  "COMPLETED",
  "SETTLED",
  "SUCCESS",
  "SUCCESSFUL",
]);
const acceptedAuthorizationStatuses = new Set(["AUTHORIZED"]);
const acceptedReversalStatuses = new Set([
  "COMPLETED",
  "REVERSED",
  "SUCCESS",
  "SUCCESSFUL",
]);

function amountToUnits(amount: string | undefined): bigint | undefined {
  if (
    typeof amount !== "string" ||
    !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/.test(amount)
  ) {
    return undefined;
  }

  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

function rememberAuthorization(
  result: any,
  payload: CreatePaymentWithPaymentInstrumentInput,
) {
  const paymentId = result?.sanitized?.id;
  const amountUnits =
    amountToUnits(
      result?.sanitized?.orderInformation?.amountDetails?.authorizedAmount,
    ) ?? amountToUnits(payload.amount);

  if (
    result?.sanitized?.status !== "AUTHORIZED" ||
    typeof paymentId !== "string" ||
    amountUnits === undefined
  ) {
    return;
  }

  authorizationRecords.set(paymentId, {
    amountUnits,
    reservedUnits: 0n,
    currency: payload.currency.toUpperCase(),
  });
}

function requireTransactionId(
  value: string,
  name: "paymentId" | "captureId",
): string {
  if (!value?.trim()) {
    throw new AppError(`${name} is required`, {
      statusCode: 400,
      code: `MISSING_${name === "paymentId" ? "PAYMENT" : "CAPTURE"}_ID`,
    });
  }

  return value;
}

function requiresProductionVerification(): boolean {
  const environment = cybsConfig.runEnvironment.trim().toLowerCase();
  const isSandboxEnvironment = environment.startsWith("apitest.");

  return process.env.NODE_ENV === "production" || !isSandboxEnvironment;
}

function assertCaptureExecutionAllowed(): boolean {
  const requiresExplicitOptIn = requiresProductionVerification();

  if (requiresExplicitOptIn && !cybsConfig.allowProductionCaptures) {
    throw new AppError(
      "Captures are disabled outside the CyberSource sandbox",
      {
        statusCode: 403,
        code: "PRODUCTION_CAPTURES_DISABLED",
      },
    );
  }

  return requiresExplicitOptIn;
}

function reserveAuthorizedAmount(
  paymentId: string,
  currency: string,
  amountUnits: bigint,
): AuthorizationRecord {
  const authorization = authorizationRecords.get(paymentId);

  if (!authorization) {
    throw new AppError(
      "The authorization is not available in this running backend process",
      {
        statusCode: 409,
        code: "AUTHORIZATION_CONTEXT_MISSING",
      },
    );
  }

  if (authorization.currency !== currency) {
    throw new AppError("Capture currency does not match the authorization", {
      statusCode: 422,
      code: "CAPTURE_CURRENCY_MISMATCH",
    });
  }

  const availableUnits =
    authorization.amountUnits - authorization.reservedUnits;

  if (availableUnits <= 0n) {
    throw new AppError("The payment has already been fully captured", {
      statusCode: 409,
      code: "PAYMENT_ALREADY_FULLY_CAPTURED",
    });
  }

  if (amountUnits > availableUnits) {
    throw new AppError(
      "Capture amount exceeds the available authorized amount",
      {
        statusCode: 422,
        code: "CAPTURE_AMOUNT_EXCEEDS_AUTHORIZATION",
      },
    );
  }

  authorization.reservedUnits += amountUnits;
  return authorization;
}

function releaseAuthorizedAmount(
  authorization: AuthorizationRecord,
  amountUnits: bigint,
) {
  authorization.reservedUnits -= amountUnits;
}

function readErrorStatus(error: any): number | undefined {
  const status =
    error?.statusCode ??
    error?.status ??
    error?.response?.statusCode ??
    error?.response?.status;
  return typeof status === "number" && Number.isInteger(status)
    ? status
    : undefined;
}

function readErrorBody(error: any): any {
  return error?.response?.body ?? error?.body;
}

function isDefinitiveCaptureRejection(error: unknown): boolean {
  const body = readErrorBody(error);
  const reason = body?.reason;

  return (
    readErrorStatus(error) === 400 &&
    typeof reason === "string" &&
    definitiveCaptureRejectionReasons.has(reason)
  );
}

function captureOutcomeUnknownError(error: unknown): AppError {
  const normalized = normalizeCybersourceError(error);

  return new AppError(
    "Capture outcome is unknown; reconcile the transaction before retrying",
    {
      statusCode: normalized.code === "CYBERSOURCE_TIMEOUT" ? 504 : 502,
      code: "CAPTURE_OUTCOME_UNKNOWN",
    },
  );
}

function normalizedApplicationName(application: any): string | undefined {
  return typeof application?.name === "string"
    ? application.name.trim().toLowerCase()
    : undefined;
}

function applicationsFrom(transaction: any): any[] {
  const applications = transaction?.applicationInformation?.applications;
  return Array.isArray(applications) ? applications : [];
}

function relevantApplications(transaction: any, names: Set<string>): any[] {
  return applicationsFrom(transaction).filter((application) => {
    const name = normalizedApplicationName(application);
    return name !== undefined && names.has(name);
  });
}

function readTransactionStatus(
  transaction: any,
  application?: any,
): string | undefined {
  const status =
    application?.status ??
    transaction?.applicationInformation?.status ??
    transaction?.status;

  return typeof status === "string" && status.trim()
    ? status.trim().toUpperCase()
    : undefined;
}

function classifyApplication(
  transaction: any,
  application: any,
  kind: "AUTHORIZATION" | "CAPTURE" | "REVERSAL",
): Exclude<ApplicationOutcome, "NONE"> {
  const status = readTransactionStatus(transaction, application);
  const rejectedByCode =
    application?.rCode === "0" || application?.rCode === "-1";
  const acceptedByCode = application?.rCode === "1";

  if (kind === "CAPTURE" && status && pendingCaptureStatuses.has(status)) {
    return rejectedByCode ? "AMBIGUOUS" : "PENDING";
  }

  const acceptedStatuses =
    kind === "AUTHORIZATION"
      ? acceptedAuthorizationStatuses
      : kind === "CAPTURE"
        ? completedCaptureStatuses
        : acceptedReversalStatuses;

  if (status && acceptedStatuses.has(status)) {
    return rejectedByCode ? "AMBIGUOUS" : "ACCEPTED";
  }

  if (acceptedByCode) {
    return kind === "CAPTURE" ? "AMBIGUOUS" : "ACCEPTED";
  }

  if (rejectedByCode) {
    return "REJECTED";
  }

  return "AMBIGUOUS";
}

function classifyRelevantApplications(
  transaction: any,
  names: Set<string>,
  kind: "AUTHORIZATION" | "CAPTURE" | "REVERSAL",
): ApplicationOutcome {
  const applications = relevantApplications(transaction, names);

  if (applications.length === 0) {
    return "NONE";
  }

  const outcomes = new Set(
    applications.map((application) =>
      classifyApplication(transaction, application, kind),
    ),
  );

  return outcomes.size === 1 ? [...outcomes][0] : "AMBIGUOUS";
}

function extractRelatedTransactionId(href: unknown): string | undefined {
  if (typeof href !== "string") {
    return undefined;
  }

  const match = href.match(
    /\/(?:transactions|captures|payments)\/([A-Za-z0-9_-]+)(?:[/?#]|$)/,
  );
  return match?.[1];
}

async function retrieveTransactionDetails(transactionId: string) {
  const apiInstance = new cybersourceRestClient.TransactionDetailsApi(
    getCybsConfigObject(),
  );

  const request = new Promise<{ data: any; response: any }>((resolve, reject) => {
    try {
      apiInstance.getTransaction(
        transactionId,
        (error: any, data: any, response: any) => {
          if (error) {
            reject(normalizeCybersourceError(error));
            return;
          }

          resolve({ data, response });
        },
      );
    } catch (error) {
      reject(normalizeCybersourceError(error));
    }
  });

  return await withTimeout(request, 30000);
}

function transactionSource(data: any, response: any): any {
  return data ?? response?.body;
}

function authorizedAmountUnits(
  transaction: any,
  rawTransaction?: any,
): bigint | undefined {
  return amountToUnits(
    transaction?.orderInformation?.amountDetails?.authorizedAmount ??
      rawTransaction?.orderInformation?.amountDetails?.authorizedAmount,
  );
}

function capturedAmountUnits(
  transaction: any,
  rawTransaction?: any,
): bigint | undefined {
  return amountToUnits(
    transaction?.orderInformation?.amountDetails?.totalAmount ??
      rawTransaction?.orderInformation?.amountDetails?.totalAmount,
  );
}

function transactionCurrency(
  transaction: any,
  rawTransaction?: any,
): string | undefined {
  const currency =
    transaction?.orderInformation?.amountDetails?.currency ??
    rawTransaction?.orderInformation?.amountDetails?.currency;
  return typeof currency === "string" ? currency.toUpperCase() : undefined;
}

function amountUnitsToString(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const absoluteUnits = units < 0n ? -units : units;
  const whole = absoluteUnits / 1000n;
  let fraction = (absoluteUnits % 1000n).toString().padStart(3, "0");

  while (fraction.length > 2 && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }

  return `${sign}${whole}.${fraction}`;
}

function safetyReason(
  message: string,
  code: string,
  statusCode = 409,
): CaptureSafetyReason {
  return { message, code, statusCode };
}

function ineligibleAssessment(
  paymentId: string,
  reason: CaptureSafetyReason,
  partial: Partial<CaptureSafetyAssessment> = {},
): CaptureSafetyAssessment {
  return {
    paymentId,
    eligible: false,
    historyVerified: false,
    ...partial,
    reason,
  };
}

function findBlockingPaymentAttempt(
  paymentId: string,
  excludedAttemptKey?: string,
): CaptureAttempt | undefined {
  return [...captureAttempts.entries()].find(
    ([attemptKey, attempt]) =>
      attemptKey !== excludedAttemptKey &&
      attempt.paymentId === paymentId &&
      (attempt.state === "IN_FLIGHT" || attempt.state === "UNKNOWN"),
  )?.[1];
}

function publicReadinessResult(
  assessment: CaptureSafetyAssessment,
): CaptureReadinessResult {
  return {
    paymentId: assessment.paymentId,
    eligible: assessment.eligible,
    authorizedAmount:
      assessment.authorizedAmountUnits === undefined
        ? null
        : amountUnitsToString(assessment.authorizedAmountUnits),
    capturedAmount:
      assessment.capturedAmountUnits === undefined
        ? null
        : amountUnitsToString(assessment.capturedAmountUnits),
    currency: assessment.currency ?? null,
    historyVerified: assessment.historyVerified,
    availableAmount:
      assessment.availableAmountUnits === undefined
        ? null
        : amountUnitsToString(assessment.availableAmountUnits),
    reason: assessment.reason
      ? {
          code: assessment.reason.code,
          message: assessment.reason.message,
        }
      : null,
  };
}

async function assessCaptureReadiness(
  paymentId: string,
  excludedAttemptKey?: string,
): Promise<CaptureSafetyAssessment> {
  const localAuthorization = authorizationRecords.get(paymentId);

  if (!localAuthorization) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "The authorization is not available in this running backend process",
        "AUTHORIZATION_CONTEXT_MISSING",
      ),
    );
  }

  const blockingAttempt = findBlockingPaymentAttempt(
    paymentId,
    excludedAttemptKey,
  );

  if (blockingAttempt?.state === "UNKNOWN") {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "A previous capture outcome is unknown and requires reconciliation",
        "CAPTURE_OUTCOME_UNKNOWN",
      ),
    );
  }

  if (blockingAttempt?.state === "IN_FLIGHT") {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "Another capture for this payment is in progress",
        "CAPTURE_IN_PROGRESS",
      ),
    );
  }

  let authorizationLookup: { data: any; response: any };

  try {
    authorizationLookup = await retrieveTransactionDetails(paymentId);
  } catch (error) {
    const normalized = normalizeCybersourceError(error);
    const isNotVisible = normalized.statusCode === 404;

    return ineligibleAssessment(
      paymentId,
      safetyReason(
        isNotVisible
          ? "The authorization is not yet visible in CyberSource Transaction Details"
          : "CyberSource authorization verification is currently unavailable",
        isNotVisible
          ? "AUTHORIZATION_NOT_VISIBLE"
          : "AUTHORIZATION_VERIFICATION_UNAVAILABLE",
        isNotVisible ? 409 : 502,
      ),
    );
  }

  const rawAuthorization = authorizationLookup.response?.body;
  const authorization = transactionSource(
    authorizationLookup.data,
    authorizationLookup.response,
  );
  const returnedPaymentId = authorization?.id ?? rawAuthorization?.id;

  if (returnedPaymentId !== paymentId) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "CyberSource returned a transaction that does not match the payment",
        "AUTHORIZATION_UNVERIFIED",
      ),
    );
  }

  const authorizationOutcome = classifyRelevantApplications(
    authorization,
    authorizationApplicationNames,
    "AUTHORIZATION",
  );

  if (authorizationOutcome !== "ACCEPTED") {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        authorizationOutcome === "AMBIGUOUS"
          ? "The authorization applications have an ambiguous or conflicting outcome"
          : "The payment authorization is not approved and capture-eligible",
        authorizationOutcome === "AMBIGUOUS"
          ? "AUTHORIZATION_STATUS_AMBIGUOUS"
          : "AUTHORIZATION_NOT_CAPTURE_ELIGIBLE",
        422,
      ),
    );
  }

  const authorizationReversalOutcome = classifyRelevantApplications(
    authorization,
    authorizationReversalApplicationNames,
    "REVERSAL",
  );

  if (authorizationReversalOutcome === "ACCEPTED") {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "The payment authorization has been reversed",
        "AUTHORIZATION_NOT_CAPTURE_ELIGIBLE",
        422,
      ),
    );
  }

  if (
    authorizationReversalOutcome === "AMBIGUOUS" ||
    authorizationReversalOutcome === "PENDING"
  ) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "The authorization reversal state cannot be verified",
        "CAPTURE_HISTORY_UNVERIFIED",
      ),
    );
  }

  const verifiedAuthorizedAmountUnits = authorizedAmountUnits(
    authorization,
    rawAuthorization,
  );
  const authorizedCurrency = transactionCurrency(
    authorization,
    rawAuthorization,
  );

  if (verifiedAuthorizedAmountUnits === undefined || !authorizedCurrency) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "The authorization amount and currency could not be verified",
        "AUTHORIZATION_UNVERIFIED",
      ),
    );
  }

  const baseAssessment: Partial<CaptureSafetyAssessment> = {
    authorizedAmountUnits: verifiedAuthorizedAmountUnits,
    capturedAmountUnits: 0n,
    availableAmountUnits: verifiedAuthorizedAmountUnits,
    currency: authorizedCurrency,
  };
  const relatedTransactions =
    authorization?._links?.relatedTransactions ??
    rawAuthorization?._links?.relatedTransactions;

  if (!Array.isArray(relatedTransactions)) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "CyberSource did not provide a related-transaction history snapshot",
        "CAPTURE_HISTORY_UNVERIFIED",
      ),
      baseAssessment,
    );
  }

  if (relatedTransactions.length > 100) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "The related-transaction history is too large for the controlled pilot",
        "CAPTURE_HISTORY_UNVERIFIED",
      ),
      baseAssessment,
    );
  }

  const relatedIds = new Set<string>();

  for (const relatedTransaction of relatedTransactions) {
    const relatedId = extractRelatedTransactionId(relatedTransaction?.href);

    if (!relatedId) {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related CyberSource transaction could not be identified",
          "CAPTURE_HISTORY_UNVERIFIED",
        ),
        baseAssessment,
      );
    }

    if (relatedId !== paymentId) {
      relatedIds.add(relatedId);
    }
  }

  let verifiedCapturedAmountUnits = 0n;
  let hasPendingCapture = false;
  const verifiedCaptureIds = new Set<string>();

  for (const relatedId of relatedIds) {
    let relatedLookup: { data: any; response: any };

    try {
      relatedLookup = await retrieveTransactionDetails(relatedId);
    } catch {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related CyberSource transaction could not be verified",
          "CAPTURE_HISTORY_UNVERIFIED",
        ),
        {
          ...baseAssessment,
          capturedAmountUnits: verifiedCapturedAmountUnits,
          availableAmountUnits:
            verifiedAuthorizedAmountUnits - verifiedCapturedAmountUnits,
        },
      );
    }

    const rawRelated = relatedLookup.response?.body;
    const related = transactionSource(relatedLookup.data, relatedLookup.response);
    const reversalOutcome = classifyRelevantApplications(
      related,
      authorizationReversalApplicationNames,
      "REVERSAL",
    );

    if (reversalOutcome === "ACCEPTED") {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "The payment authorization has been reversed",
          "AUTHORIZATION_NOT_CAPTURE_ELIGIBLE",
          422,
        ),
        {
          ...baseAssessment,
          capturedAmountUnits: verifiedCapturedAmountUnits,
          availableAmountUnits:
            verifiedAuthorizedAmountUnits - verifiedCapturedAmountUnits,
          historyVerified: true,
        },
      );
    }

    if (reversalOutcome === "AMBIGUOUS" || reversalOutcome === "PENDING") {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related authorization reversal has an ambiguous outcome",
          "CAPTURE_HISTORY_UNVERIFIED",
        ),
        baseAssessment,
      );
    }

    const captureOutcome = classifyRelevantApplications(
      related,
      captureApplicationNames,
      "CAPTURE",
    );

    if (captureOutcome === "NONE" || captureOutcome === "REJECTED") {
      continue;
    }

    const relatedRootId = related?.rootId ?? rawRelated?.rootId;

    if (relatedRootId !== paymentId) {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related capture could not be tied to the authorization",
          "CAPTURE_HISTORY_UNVERIFIED",
        ),
        baseAssessment,
      );
    }

    if (captureOutcome === "AMBIGUOUS") {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related capture has an ambiguous or conflicting outcome",
          "CAPTURE_HISTORY_UNVERIFIED",
        ),
        baseAssessment,
      );
    }

    const relatedCurrency = transactionCurrency(related, rawRelated);
    const relatedCapturedAmountUnits = capturedAmountUnits(
      related,
      rawRelated,
    );

    if (relatedCurrency !== authorizedCurrency) {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related capture currency does not match the authorization",
          "CAPTURE_CURRENCY_MISMATCH",
          422,
        ),
        baseAssessment,
      );
    }

    if (relatedCapturedAmountUnits === undefined) {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "A related capture amount could not be verified",
          "CAPTURE_HISTORY_UNVERIFIED",
        ),
        baseAssessment,
      );
    }

    verifiedCapturedAmountUnits += relatedCapturedAmountUnits;
    verifiedCaptureIds.add(relatedId);
    hasPendingCapture ||= captureOutcome === "PENDING";
  }

  for (const [attemptKey, attempt] of captureAttempts) {
    if (
      attemptKey !== excludedAttemptKey &&
      attempt.paymentId === paymentId &&
      attempt.state === "COMPLETED" &&
      (!attempt.captureId || !verifiedCaptureIds.has(attempt.captureId))
    ) {
      return ineligibleAssessment(
        paymentId,
        safetyReason(
          "CyberSource Transaction Details has not indexed a locally accepted capture",
          "CAPTURE_HISTORY_NOT_SYNCHRONIZED",
        ),
        {
          ...baseAssessment,
          capturedAmountUnits: verifiedCapturedAmountUnits,
          availableAmountUnits:
            verifiedAuthorizedAmountUnits - verifiedCapturedAmountUnits,
        },
      );
    }
  }

  const availableAmountUnits =
    verifiedAuthorizedAmountUnits - verifiedCapturedAmountUnits;
  const verifiedAssessment: Partial<CaptureSafetyAssessment> = {
    ...baseAssessment,
    capturedAmountUnits: verifiedCapturedAmountUnits,
    availableAmountUnits,
    historyVerified: true,
  };

  if (availableAmountUnits < 0n) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "Verified capture totals exceed the authorized amount",
        "CAPTURE_TOTAL_EXCEEDS_AUTHORIZATION",
        422,
      ),
      verifiedAssessment,
    );
  }

  if (hasPendingCapture) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "A prior capture is still pending reconciliation",
        "CAPTURE_RECONCILIATION_PENDING",
      ),
      verifiedAssessment,
    );
  }

  if (availableAmountUnits === 0n) {
    return ineligibleAssessment(
      paymentId,
      safetyReason(
        "The payment has already been fully captured",
        "PAYMENT_ALREADY_FULLY_CAPTURED",
      ),
      verifiedAssessment,
    );
  }

  return {
    paymentId,
    eligible: true,
    historyVerified: true,
    authorizedAmountUnits: verifiedAuthorizedAmountUnits,
    capturedAmountUnits: verifiedCapturedAmountUnits,
    availableAmountUnits,
    currency: authorizedCurrency,
  };
}

async function verifyProductionCaptureSafety(
  paymentId: string,
  currency: string,
  amountUnits: bigint,
  currentAttemptKey: string,
) {
  const assessment = await assessCaptureReadiness(
    paymentId,
    currentAttemptKey,
  );

  if (!assessment.eligible) {
    const reason =
      assessment.reason ??
      safetyReason(
        "Capture eligibility could not be verified",
        "CAPTURE_HISTORY_UNVERIFIED",
      );
    throw new AppError(reason.message, {
      statusCode: reason.statusCode,
      code: reason.code,
    });
  }

  if (assessment.currency !== currency) {
    throw new AppError(
      "Capture currency does not match the verified authorization",
      {
        statusCode: 422,
        code: "CAPTURE_CURRENCY_MISMATCH",
      },
    );
  }

  if (
    assessment.availableAmountUnits === undefined ||
    amountUnits > assessment.availableAmountUnits
  ) {
    throw new AppError(
      "Capture amount exceeds the verified available authorization",
      {
        statusCode: 422,
        code: "CAPTURE_AMOUNT_EXCEEDS_AUTHORIZATION",
      },
    );
  }
}

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

  const result = await withTimeout(cybsRequest, 30000);
  rememberAuthorization(result, payload);
  return result;
}

export async function captureAuthorizedPayment(
  paymentId: string,
  payload: CapturePaymentInput,
) {
  const validatedPaymentId = requireTransactionId(paymentId, "paymentId");
  const amountUnits = amountToUnits(payload?.amount);
  const currency = payload?.currency?.toUpperCase();

  if (amountUnits === undefined || amountUnits <= 0n) {
    throw new AppError("amount must be greater than zero", {
      statusCode: 400,
      code: "INVALID_CAPTURE_AMOUNT",
    });
  }

  if (!payload?.referenceCode?.trim()) {
    throw new AppError("referenceCode is required", {
      statusCode: 400,
      code: "MISSING_REFERENCE_CODE",
    });
  }

  if (!currency) {
    throw new AppError("currency is required", {
      statusCode: 400,
      code: "MISSING_CAPTURE_CURRENCY",
    });
  }

  const mustVerifyProductionState = assertCaptureExecutionAllowed();

  const attemptKey = `${validatedPaymentId}:${payload.referenceCode.trim()}`;
  const previousAttempt = captureAttempts.get(attemptKey);

  if (previousAttempt) {
    if (previousAttempt.state === "UNKNOWN") {
      throw new AppError(
        "A previous capture outcome is unknown; reconcile it before retrying",
        {
          statusCode: 409,
          code: "CAPTURE_OUTCOME_UNKNOWN",
        },
      );
    }

    throw new AppError(
      `A capture with this paymentId and referenceCode is already ${previousAttempt.state.toLowerCase()}`,
      {
        statusCode: 409,
        code: "DUPLICATE_CAPTURE",
      },
    );
  }

  const blockingPaymentAttempt = findBlockingPaymentAttempt(validatedPaymentId);

  if (blockingPaymentAttempt?.state === "UNKNOWN") {
    throw new AppError(
      "A previous capture outcome is unknown; reconcile it before another capture",
      {
        statusCode: 409,
        code: "CAPTURE_OUTCOME_UNKNOWN",
      },
    );
  }

  if (blockingPaymentAttempt?.state === "IN_FLIGHT") {
    throw new AppError("Another capture for this payment is in progress", {
      statusCode: 409,
      code: "CAPTURE_IN_PROGRESS",
    });
  }

  let apiInstance: any;
  let requestObj: any;

  try {
    apiInstance = new cybersourceRestClient.CaptureApi(getCybsConfigObject());
    requestObj = buildCapturePaymentRequest({ ...payload, currency });
  } catch {
    throw new AppError("Capture request could not be prepared", {
      statusCode: 500,
      code: "CAPTURE_PREPARATION_FAILED",
    });
  }

  const authorization = reserveAuthorizedAmount(
    validatedPaymentId,
    currency,
    amountUnits,
  );
  captureAttempts.set(attemptKey, {
    paymentId: validatedPaymentId,
    referenceCode: payload.referenceCode.trim(),
    amountUnits,
    state: "IN_FLIGHT",
  });

  if (mustVerifyProductionState) {
    try {
      await verifyProductionCaptureSafety(
        validatedPaymentId,
        currency,
        amountUnits,
        attemptKey,
      );
    } catch (error) {
      captureAttempts.delete(attemptKey);
      releaseAuthorizedAmount(authorization, amountUnits);
      throw error instanceof AppError
        ? error
        : normalizeCybersourceError(error);
    }
  }

  const cybsRequest = new Promise<any>((resolve, reject) => {
    try {
      apiInstance.capturePayment(
        requestObj,
        validatedPaymentId,
        (error: any, data: any, response: any) => {
          if (error) {
            reject(error);
            return;
          }

          try {
            const result = mapCaptureResponse(
              data,
              response,
              validatedPaymentId,
              { ...payload, currency },
            );

            if (
              typeof result?.sanitized?.captureId !== "string" ||
              !result.sanitized.captureId.trim() ||
              typeof result?.sanitized?.status !== "string" ||
              !result.sanitized.status.trim() ||
              typeof result?.responseStatus !== "number" ||
              result.responseStatus < 200 ||
              result.responseStatus >= 300
            ) {
              throw new Error("Unexpected CyberSource capture response");
            }

            resolve(result);
          } catch (mappingError) {
            reject(mappingError);
          }
        },
      );
    } catch (error) {
      reject(error);
    }
  });

  try {
    const result = await withTimeout(cybsRequest, 30000);
    captureAttempts.set(attemptKey, {
      paymentId: validatedPaymentId,
      referenceCode: payload.referenceCode.trim(),
      amountUnits,
      state: "COMPLETED",
      captureId: result?.sanitized?.captureId,
    });
    return result;
  } catch (error) {
    if (isDefinitiveCaptureRejection(error)) {
      captureAttempts.delete(attemptKey);
      releaseAuthorizedAmount(authorization, amountUnits);
      throw normalizeCybersourceError(error);
    }

    captureAttempts.set(attemptKey, {
      paymentId: validatedPaymentId,
      referenceCode: payload.referenceCode.trim(),
      amountUnits,
      state: "UNKNOWN",
    });
    throw captureOutcomeUnknownError(error);
  }
}

export async function getCaptureReadiness(
  paymentId: string,
): Promise<CaptureReadinessResult> {
  const validatedPaymentId = requireTransactionId(paymentId, "paymentId");
  const assessment = await assessCaptureReadiness(validatedPaymentId);
  return publicReadinessResult(assessment);
}

export async function getCaptureStatus(captureId: string) {
  const validatedCaptureId = requireTransactionId(captureId, "captureId");
  const { data, response } = await retrieveTransactionDetails(
    validatedCaptureId,
  );

  try {
    return mapCaptureStatusResponse(data, response, validatedCaptureId);
  } catch {
    throw new AppError("CyberSource returned an invalid transaction response", {
      statusCode: 502,
      code: "CYBERSOURCE_RESPONSE_INVALID",
    });
  }
}
