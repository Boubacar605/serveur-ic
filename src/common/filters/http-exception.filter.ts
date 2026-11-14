import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    let message: unknown = raw;
    let errorCode: string | undefined;
    let errors: unknown;
    if (raw && typeof raw === 'object') {
      const payload = raw as Record<string, unknown> & { message?: unknown };
      if (typeof payload.errorCode === 'string') errorCode = payload.errorCode;
      else if (typeof payload.code === 'string') errorCode = payload.code;
      if (payload.errors !== undefined) errors = payload.errors;
      else if (payload.details !== undefined) errors = payload.details;
      if (typeof payload.message === 'string' || Array.isArray(payload.message)) {
        message = payload.message;
      } else if (payload.message && typeof payload.message === 'object') {
        const nested = payload.message as { message?: unknown; errorCode?: unknown; code?: unknown };
        message = nested.message ?? payload.message;
        if (!errorCode && typeof nested.errorCode === 'string') errorCode = nested.errorCode;
        if (!errorCode && typeof nested.code === 'string') errorCode = nested.code;
      } else if (typeof payload.error === 'string') {
        message = payload.error;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(errorCode ? { errorCode } : {}),
      ...(errors !== undefined ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
