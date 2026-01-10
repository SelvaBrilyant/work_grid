import { Request, Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "../types/index.js";

/**
 * Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors and pass them to the error handler
 * This eliminates the need for try-catch blocks in every controller method
 */

type AsyncFunction = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export const asyncHandler = (fn: AsyncFunction): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
  };
};

export default asyncHandler;
