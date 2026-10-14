import { Request, Response } from "express";
import {
  createInstrumentIdentifier,
  createPaymentInstrument,
} from "../services/tms.services.js";

function sanitizeError(error: any) {
  return {
    message: error?.message,
    statusCode: error?.statusCode || error?.status,
    responseBody: error?.response?.body,
    responseText: error?.response?.text,
  };
}

export async function createInstrumentIdentifierController(
  req: Request,
  res: Response,
) {
  try {
    const result = await createInstrumentIdentifier(req.body);

    return res.status(201).json({
      success: true,
      message: "Instrument Identifier created successfully",
      data: result,
    });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);

    console.error(
      "TMS create instrument identifier error:",
      JSON.stringify(sanitizedError, null, 2),
    );

    return res.status(error?.statusCode || error?.status || 500).json({
      success: false,
      message: "Could not create Instrument Identifier",
      error: sanitizedError,
    });
  }
}

export async function createPaymentInstrumentController(
  req: Request,
  res: Response,
) {
  try {
    const result = await createPaymentInstrument(req.body);

    return res.status(201).json({
      success: true,
      message: "Payment Instrument created successfully",
      data: result,
    });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);

    console.error(
      "TMS create payment instrument error:",
      JSON.stringify(sanitizedError, null, 2),
    );

    return res.status(error?.statusCode || error?.status || 500).json({
      success: false,
      message: "Could not create Payment Instrument",
      error: sanitizedError,
    });
  }
}
