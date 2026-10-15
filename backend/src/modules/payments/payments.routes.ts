import { Router } from "express";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  captureAuthorizedPaymentController,
  createPaymentWithPaymentInstrumentController,
  getCaptureReadinessController,
  getCaptureStatusController,
} from "./payments.controller.js";
import {
  captureIdParamsSchema,
  capturePaymentSchema,
  paymentIdParamsSchema,
} from "./payments.schemas.js";

const router = Router();
export const paymentOperationsRouter = Router();

router.post(
  "/payment-instrument",
  asyncHandler(createPaymentWithPaymentInstrumentController, {
    errorMessage: "Could not create payment with Payment Instrument",
    logLabel: "Payment with Payment Instrument error",
  }),
);

paymentOperationsRouter.post(
  "/:paymentId/captures",
  validateRequest({
    params: paymentIdParamsSchema,
    body: capturePaymentSchema,
  }),
  asyncHandler(captureAuthorizedPaymentController, {
    errorMessage: "Could not capture payment",
    logLabel: "Payment capture error",
  }),
);

paymentOperationsRouter.get(
  "/:paymentId/capture-readiness",
  validateRequest({ params: paymentIdParamsSchema }),
  asyncHandler(getCaptureReadinessController, {
    errorMessage: "Could not evaluate capture readiness",
    logLabel: "Capture readiness error",
  }),
);

paymentOperationsRouter.get(
  "/captures/:captureId",
  validateRequest({ params: captureIdParamsSchema }),
  asyncHandler(getCaptureStatusController, {
    errorMessage: "Could not retrieve capture status",
    logLabel: "Capture status lookup error",
  }),
);

export default router;
