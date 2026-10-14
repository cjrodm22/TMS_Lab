import { Router } from "express";
import { createPaymentWithPaymentInstrumentController } from "../controllers/payment.controller.js";

const router = Router();

router.post(
  "/payment-instrument",
  createPaymentWithPaymentInstrumentController,
);

export default router;
