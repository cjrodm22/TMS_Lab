import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createInstrumentIdentifierController,
  createPaymentInstrumentController,
} from "./tms.controller.js";

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

export default router;
