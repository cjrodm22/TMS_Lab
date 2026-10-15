import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import {
  createInstrumentIdentifierController,
  createPaymentInstrumentController,
  getInstrumentIdentifierController,
  getPaymentInstrumentController,
  listPaymentInstrumentsForInstrumentIdentifierController,
  updateInstrumentIdentifierController,
  updatePaymentInstrumentController,
} from "./tms.controller.js";
import {
  patchInstrumentIdentifierSchema,
  patchPaymentInstrumentSchema,
  tokenIdParamsSchema,
} from "./tms.schemas.js";

const router = Router();

router.post(
  "/instrument-identifiers",
  asyncHandler(createInstrumentIdentifierController, {
    errorMessage: "Could not create Instrument Identifier",
    logLabel: "TMS create instrument identifier error",
  }),
);

router.post(
  "/payment-instruments",
  asyncHandler(createPaymentInstrumentController, {
    errorMessage: "Could not create Payment Instrument",
    logLabel: "TMS create payment instrument error",
  }),
);

router.get(
  "/instrument-identifiers/:id/payment-instruments",
  validateRequest({ params: tokenIdParamsSchema }),
  asyncHandler(listPaymentInstrumentsForInstrumentIdentifierController, {
    errorMessage: "Could not retrieve Payment Instruments",
    logLabel: "TMS list payment instruments error",
  }),
);

router.get(
  "/instrument-identifiers/:id",
  validateRequest({ params: tokenIdParamsSchema }),
  asyncHandler(getInstrumentIdentifierController, {
    errorMessage: "Could not retrieve Instrument Identifier",
    logLabel: "TMS get instrument identifier error",
  }),
);

router.get(
  "/payment-instruments/:id",
  validateRequest({ params: tokenIdParamsSchema }),
  asyncHandler(getPaymentInstrumentController, {
    errorMessage: "Could not retrieve Payment Instrument",
    logLabel: "TMS get payment instrument error",
  }),
);

router.patch(
  "/payment-instruments/:id",
  validateRequest({
    params: tokenIdParamsSchema,
    body: patchPaymentInstrumentSchema,
  }),
  asyncHandler(updatePaymentInstrumentController, {
    errorMessage: "Could not update Payment Instrument",
    logLabel: "TMS update payment instrument error",
  }),
);

router.patch(
  "/instrument-identifiers/:id",
  validateRequest({
    params: tokenIdParamsSchema,
    body: patchInstrumentIdentifierSchema,
  }),
  asyncHandler(updateInstrumentIdentifierController, {
    errorMessage: "Could not update Instrument Identifier",
    logLabel: "TMS update instrument identifier error",
  }),
);

export default router;
