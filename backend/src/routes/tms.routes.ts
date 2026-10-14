import { Router } from "express";
import {
  createInstrumentIdentifierController,
  createPaymentInstrumentController,
} from "../controllers/tms.controller.js";

const router = Router();

router.post("/instrument-identifiers", createInstrumentIdentifierController);
router.post("/payment-instruments", createPaymentInstrumentController);

export default router;
