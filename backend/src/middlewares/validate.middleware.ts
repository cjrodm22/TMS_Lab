import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { AppError } from "../utils/appError.js";

interface RequestSchemas {
  params?: ZodType;
  body?: ZodType;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }

      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      next();
    } catch (error) {
      if (!(error instanceof ZodError)) {
        next(error);
        return;
      }

      next(
        new AppError("Request validation failed", {
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
    }
  };
}
