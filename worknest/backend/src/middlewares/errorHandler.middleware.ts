import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils/AppError.js";
import mongoose from "mongoose";

/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate JSON responses
 */

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

/**
 * Handle Mongoose CastError (invalid ObjectId)
 */
const handleCastError = (err: mongoose.Error.CastError): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, "INVALID_ID");
};

/**
 * Handle Mongoose Duplicate Key Error
 */
const handleDuplicateKeyError = (
  err: Error & { keyValue?: Record<string, unknown> }
): AppError => {
  const field = Object.keys(err.keyValue || {})[0];
  const message = `Duplicate value for field: ${field}`;
  return new AppError(message, 409, "DUPLICATE_KEY");
};

/**
 * Handle Mongoose Validation Error
 */
const handleValidationError = (
  err: mongoose.Error.ValidationError
): ValidationError => {
  const errors: Record<string, string[]> = {};

  Object.values(err.errors).forEach((error) => {
    const field = error.path;
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(error.message);
  });

  return new ValidationError("Validation failed", errors, "VALIDATION_ERROR");
};

/**
 * Handle JWT Errors
 */
const handleJWTError = (): AppError => {
  return new AppError(
    "Invalid token. Please log in again.",
    401,
    "INVALID_TOKEN"
  );
};

const handleJWTExpiredError = (): AppError => {
  return new AppError(
    "Your token has expired. Please log in again.",
    401,
    "TOKEN_EXPIRED"
  );
};

/**
 * Send Error Response for Development Environment
 */
const sendErrorDev = (err: AppError, res: Response): void => {
  const response: ErrorResponse = {
    success: false,
    error: err.message,
    code: err.code,
    stack: err.stack,
  };

  if (err instanceof ValidationError && err.errors) {
    response.errors = err.errors;
  }

  res.status(err.statusCode).json(response);
};

/**
 * Send Error Response for Production Environment
 */
const sendErrorProd = (err: AppError, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response: ErrorResponse = {
      success: false,
      error: err.message,
      code: err.code,
    };

    if (err instanceof ValidationError && err.errors) {
      response.errors = err.errors;
    }

    res.status(err.statusCode).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    console.error("ERROR 💥:", err);

    res.status(500).json({
      success: false,
      error: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Global Error Handler
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error: AppError;

  // If it's already an AppError, use it directly
  if (err instanceof AppError) {
    error = err;
  } else {
    // Handle specific error types
    if (err.name === "CastError") {
      error = handleCastError(err as mongoose.Error.CastError);
    } else if ((err as Error & { code?: number }).code === 11000) {
      error = handleDuplicateKeyError(
        err as Error & { keyValue?: Record<string, unknown> }
      );
    } else if (err.name === "ValidationError") {
      error = handleValidationError(err as mongoose.Error.ValidationError);
    } else if (err.name === "JsonWebTokenError") {
      error = handleJWTError();
    } else if (err.name === "TokenExpiredError") {
      error = handleJWTExpiredError();
    } else {
      // Unknown error
      error = new AppError(err.message || "Something went wrong", 500);
      error.stack = err.stack;
    }
  }

  // Log error in development
  if (process.env.NODE_ENV !== "production") {
    console.error("Error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  }

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === "production") {
    sendErrorProd(error, res);
  } else {
    sendErrorDev(error, res);
  }
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
};

export default errorHandler;
