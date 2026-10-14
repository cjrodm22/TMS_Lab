import type { Request, Response } from "express";
import { createPaymentWithPaymentInstrument } from "./payments.service.js";

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
