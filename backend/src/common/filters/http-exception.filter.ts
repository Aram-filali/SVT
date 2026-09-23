import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse: any = exception instanceof HttpException ? exception.getResponse() : null;

    response
      .status(status)
      .json({
        statusCode: status,
        message: exceptionResponse?.message || exception.message || 'Internal server error',
        error: exceptionResponse?.error || null,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
  }
}