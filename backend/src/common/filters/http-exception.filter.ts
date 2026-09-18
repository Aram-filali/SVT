import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    response
      .status(status)
      .json({
        statusCode: status,
        message: exceptionResponse.message || exception.message,
        error: exceptionResponse.error || null,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
  }
}
