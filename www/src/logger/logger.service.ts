import { Injectable, LoggerService as NestLoggerService, Logger } from '@nestjs/common';
import tracer from 'dd-trace';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly localLogger: Logger;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    // Initialize local logger
    this.localLogger = new Logger(serviceName);
    this.serviceName = serviceName;
  }

  log(message: any, context?: string) {
    // Always log locally
    this.localLogger.log(message, context);

    // Send to external service (only in production or when explicitly enabled)
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('info', message, this.serviceName, context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    this.localLogger.error(message, trace, context);

    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('error', message, this.serviceName, context, trace);
    }
  }

  warn(message: any, context?: string) {
    this.localLogger.warn(message, context);

    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('warn', message, this.serviceName, context);
    }
  }

  debug(message: any, context?: string) {
    this.localLogger.debug(message, context);
  }

  verbose(message: any, context?: string) {
    this.localLogger.verbose(message, context);
  }

  private sendToExternalService(
    level: string,
    message: any,
    serviceName: string,
    context?: string,
    trace?: string,
  ) {
    try {
      const span = tracer.scope().active();
      const logData = {
        level,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        context,
        timestamp: new Date().toISOString(),
        service: serviceName,
        env: process.env.NODE_ENV || 'development',
        ...(span && {
          trace_id: span.context().toTraceId(),
          span_id: span.context().toSpanId(),
        }),
        ...(trace && { stack_trace: trace }),
      };

      // Send metrics to external service
      tracer.dogstatsd.increment('app.logs.count', 1, {
        level,
        service: logData.service,
        env: logData.env,
      });

      // For production, send structured logs
      if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(logData));
      }
    } catch (error) {
      // Fallback to local logging if external service fails
      this.localLogger.error(
        `Failed to send log to external service: ${error}`,
        undefined,
        'LoggerService',
      );
    }
  }
}
