import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface AsyncHandlerOptions {
  errorMessage: string;
  logLabel: string;
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(
  handler: AsyncRequestHandler,
  options: AsyncHandlerOptions,
): RequestHandler {
  return (req, res, next) => {
    res.locals.errorMessage = options.errorMessage;
    res.locals.errorLogLabel = options.logLabel;

    void Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}
