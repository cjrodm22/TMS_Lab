import { Request, Response } from "express";
import { createPaymentWithPaymentInstrument } from "../services/payment.services.js";

function sanitizeError(error: any) {
  return {
    message: error?.message,
    statusCode: error?.statusCode || error?.status,
    responseBody: error?.response?.body,
    responseText: error?.response?.text,
  };
}

export async function createPaymentWithPaymentInstrumentController(
  req: Request,
  res: Response,
) {
  try {
    const result = await createPaymentWithPaymentInstrument(req.body);

    return res.status(201).json({
      success: true,
      message: "Payment with Payment Instrument created successfully",
      data: result,
    });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error);

    console.error(
      "Payment with Payment Instrument error:",
      JSON.stringify(sanitizedError, null, 2),
    );

    return res.status(error?.statusCode || error?.status || 500).json({
      success: false,
      message: "Could not create payment with Payment Instrument",
      error: sanitizedError,
    });
  }
}
