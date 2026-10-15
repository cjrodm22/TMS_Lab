import type { Request, Response } from "express";
import {
  createInstrumentIdentifier,
  createPaymentInstrument,
  getInstrumentIdentifier,
  getPaymentInstrument,
  listPaymentInstrumentsForInstrumentIdentifier,
  updateInstrumentIdentifier,
  updatePaymentInstrument,
} from "./tms.service.js";

function getTokenId(req: Request): string {
  return req.params.id as string;
}

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

export async function getInstrumentIdentifierController(
  req: Request,
  res: Response,
) {
  const result = await getInstrumentIdentifier(getTokenId(req));

  return res.status(200).json({
    success: true,
    message: "Instrument Identifier retrieved successfully",
    data: result,
  });
}

export async function getPaymentInstrumentController(
  req: Request,
  res: Response,
) {
  const result = await getPaymentInstrument(getTokenId(req));

  return res.status(200).json({
    success: true,
    message: "Payment Instrument retrieved successfully",
    data: result,
  });
}

export async function listPaymentInstrumentsForInstrumentIdentifierController(
  req: Request,
  res: Response,
) {
  const result = await listPaymentInstrumentsForInstrumentIdentifier(
    getTokenId(req),
  );

  return res.status(200).json({
    success: true,
    message: "Payment Instruments retrieved successfully",
    data: result,
  });
}

export async function updatePaymentInstrumentController(
  req: Request,
  res: Response,
) {
  const result = await updatePaymentInstrument(getTokenId(req), req.body);

  return res.status(200).json({
    success: true,
    message: "Payment Instrument updated successfully",
    data: result,
  });
}

export async function updateInstrumentIdentifierController(
  req: Request,
  res: Response,
) {
  const result = await updateInstrumentIdentifier(getTokenId(req), req.body);

  return res.status(200).json({
    success: true,
    message: "Instrument Identifier updated successfully",
    data: result,
  });
}
