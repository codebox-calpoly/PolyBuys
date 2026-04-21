type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {}),
  };
}

function serializeValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nestedValue]) => [key, serializeValue(nestedValue)] as const)
        .filter(([, nestedValue]) => nestedValue !== undefined)
    );
  }

  return value;
}

function writeLog(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    service: 'polybuys-backend',
    ...Object.fromEntries(
      Object.entries(context)
        .map(([key, value]) => [key, serializeValue(value)] as const)
        .filter(([, value]) => value !== undefined)
    ),
  });

  switch (level) {
    case 'info':
      console.info(payload);
      break;
    case 'warn':
      console.warn(payload);
      break;
    case 'error':
      console.error(payload);
      break;
  }
}

export function logInfo(event: string, context?: LogContext) {
  writeLog('info', event, context);
}

export function logWarn(event: string, context?: LogContext) {
  writeLog('warn', event, context);
}

export function logError(event: string, context?: LogContext) {
  writeLog('error', event, context);
}
