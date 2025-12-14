class AppError extends Error {
  public message: string;
  public status: number;
  public code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);

    this.message = message;
    this.status = status || 500;
    this.code = code;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, "BAD_REQUEST");
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401, "UNAUTHORIZED");
  }
}

export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  UnauthorizedError,
};
