/**
 * Custom Application Error class
 * Extends the native Error class with additional properties for HTTP status codes
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 400 Bad Request Error
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", code?: string) {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required", code?: string) {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden Error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden", code?: string) {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", code?: string) {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict Error
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists", code?: string) {
    super(message, 409, code);
  }
}

/**
 * 422 Validation Error
 */
export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string = "Validation failed",
    errors?: Record<string, string[]>,
    code?: string
  ) {
    super(message, 422, code);
    this.errors = errors;
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends AppError {
  constructor(message: string = "Internal server error", code?: string) {
    super(message, 500, code, false);
  }
}

export default AppError;
