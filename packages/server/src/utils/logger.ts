/**
 * Simple structured logger for the ArmiAI Server.
 *
 * Provides consistent log formatting with severity levels.
 * Can be swapped out for a more sophisticated logger (e.g., pino, winston) later.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function formatLog(entry: LogEntry): string {
  const { level, message, timestamp, context } = entry;
  const base = `[${timestamp}] [${level}] ${message}`;
  if (context && Object.keys(context).length > 0) {
    return `${base} ${JSON.stringify(context)}`;
  }
  return base;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.DEBUG:
      if (process.env.NODE_ENV === 'development') {
        console.debug(formatted);
      }
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log(LogLevel.DEBUG, message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    log(LogLevel.INFO, message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log(LogLevel.WARN, message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log(LogLevel.ERROR, message, context),
};

export default logger;
