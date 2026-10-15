import type { Request, Response } from "express";
import {
  captureAuthorizedPayment,
  createPaymentWithPaymentInstrument,
  getCaptureReadiness,
  getCaptureStatus,
} from "./payments.service.js";

export async function createPaymentWithPaymentInstrumentController(
  req: Request,
  res: Response,
) {
  const result = await createPaymentWithPaymentInstrument(req.body);

  return res.status(201).json({
    success: true,
    message: "Payment with Payment Instrument created successfully",
    data: result,
  });
}

export async function captureAuthorizedPaymentController(
  req: Request,
  res: Response,
) {
  const result = await captureAuthorizedPayment(
    req.params.paymentId as string,
    req.body,
  );

  return res.status(201).json({
    success: true,
    message: "Payment capture submitted successfully",
    data: result,
  });
}

export async function getCaptureStatusController(
  req: Request,
  res: Response,
) {
  const result = await getCaptureStatus(req.params.captureId as string);

  return res.status(200).json({
    success: true,
    message: "Capture status retrieved successfully",
    data: result,
  });
}

export async function getCaptureReadinessController(
  req: Request,
  res: Response,
) {
  const result = await getCaptureReadiness(req.params.paymentId as string);

  return res.status(200).json({
    success: true,
    message: "Capture readiness evaluated successfully",
    data: result,
  });
}
