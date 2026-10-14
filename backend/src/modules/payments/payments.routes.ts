import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createPaymentWithPaymentInstrumentController } from "./payments.controller.js";

const router = Router();

router.post(
  "/payment-instrument",
  asyncHandler(createPaymentWithPaymentInstrumentController, {
    errorMessage: "Could not create payment with Payment Instrument",
    logLabel: "Payment with Payment Instrument error",
  }),
);

export default router;
