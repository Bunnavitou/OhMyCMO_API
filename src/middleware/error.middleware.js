import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      message = `Unique constraint failed on field(s): ${err.meta?.target}`;
    } else if (err.code === 'P2025') {
      status = 404;
      message = 'Record not found';
    } else {
      status = 400;
      message = `Database error: ${err.code}`;
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    status = 400;
    message = 'Invalid data provided to database';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (err.message) {
    message = err.message;
  }

  if (env.isDev) {
    console.error('[error]', err);
  }

  res.status(status).json({
    success: false,
    error: { message, ...(details ? { details } : {}) },
    ...(env.isDev ? { stack: err.stack } : {}),
  });
}
