import { LoggerService as NestLoggerService, Logger } from '@nestjs/common';
import tracer from 'dd-trace';

export class LoggerNoPHI implements NestLoggerService {
  private readonly localLogger: Logger;
  private readonly source: string;

  constructor(source: string) {
    // Initialize local logger
    this.localLogger = new Logger(source);
    this.source = source;
  }

  log(message: any, context?: string) {
    // Send to external service (only in production or when explicitly enabled)
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('info', message, this.source, context);
    } else {
      this.localLogger.log(message, context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('error', message, this.source, context, trace);
    } else {
      this.localLogger.error(message, trace, context);
    }
  }

  warn(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('warn', message, this.source, context);
    } else {
      this.localLogger.warn(message, context);
    }
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.localLogger.debug(message, context);
    }
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.localLogger.verbose(message, context);
    }
  }

  private sendToExternalService(
    level: string,
    message: any,
    source: string,
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
        source: source,
        service: 'care-activation',
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
        source: logData.source,
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
