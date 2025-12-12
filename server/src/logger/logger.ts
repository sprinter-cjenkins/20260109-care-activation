/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoggerService as NestLoggerService, Logger } from '@nestjs/common';
import tracer from 'dd-trace';
import { PHISanitizer } from './phi-sanitizer';

export class LoggerNoPHI implements NestLoggerService {
  private readonly localLogger: Logger;
  private readonly source: string;

  constructor(source: string) {
    // Initialize local logger
    this.localLogger = new Logger(source);
    this.source = source;
  }

  log(message: string, tags: Record<string, any> = {}) {
    // Send to external service (only in production or when explicitly enabled)
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('info', message, this.source, tags);
    } else {
      // For test, sanitize the log
      this.localLogger.log(message, tags);
    }
  }

  error(message: string, tags: Record<string, any> = {}, trace?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('error', message, this.source, tags, trace);
    } else {
      const extraParams = {
        ...tags,
        ...(trace && { trace }),
      };
      this.localLogger.error(message, extraParams);
    }
  }

  warn(message: string, tags: Record<string, any> = {}) {
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService('warn', message, this.source, tags);
    } else {
      this.localLogger.warn(message, tags);
    }
  }

  debug(message: string, tags: Record<string, any> = {}) {
    if (process.env.NODE_ENV !== 'production') {
      this.localLogger.debug(message, tags);
    }
  }

  verbose(message: string, tags: Record<string, any> = {}) {
    if (process.env.NODE_ENV !== 'production') {
      this.localLogger.verbose(message, tags);
    }
  }

  private sendToExternalService(
    level: string,
    message: any,
    source: string,
    tags: Record<string, any>,
    trace?: string,
  ) {
    try {
      const span = tracer.scope().active();
      const sanitizedTags = PHISanitizer.sanitizeObject(tags) as Record<string, unknown>;
      const logData = {
        level,
        message: PHISanitizer.sanitizeForLogging(message),
        timestamp: new Date().toISOString(),
        source: source,
        service: 'care-activation',
        env: process.env.NODE_ENV || 'development',
        ...(span && {
          trace_id: span.context().toTraceId(),
          span_id: span.context().toSpanId(),
        }),
        ...(trace && { stack_trace: PHISanitizer.sanitizeForLogging(trace) }),
        ...sanitizedTags,
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
