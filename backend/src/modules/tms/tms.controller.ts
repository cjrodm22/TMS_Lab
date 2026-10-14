import type { Request, Response } from "express";
import {
  createInstrumentIdentifier,
  createPaymentInstrument,
} from "./tms.service.js";

export async function createInstrumentIdentifierController(
  req: Request,
  res: Response,
) {
  const result = await createInstrumentIdentifier(req.body);

  return res.status(201).json({
    success: true,
    message: "Instrument Identifier created successfully",
    data: result,
  });
}

export async function createPaymentInstrumentController(
  req: Request,
  res: Response,
) {
  const result = await createPaymentInstrument(req.body);

  return res.status(201).json({
    success: true,
    message: "Payment Instrument created successfully",
    data: result,
  });
}
