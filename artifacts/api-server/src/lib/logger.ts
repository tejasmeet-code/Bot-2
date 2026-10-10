import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  meta?: any;
}

export const recentLogs: LogEntry[] = [];
const MAX_LOGS = 500;

export function addLogEntry(level: "info" | "warn" | "error" | "debug", message: string, meta?: any) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    meta,
  };
  recentLogs.push(entry);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }
}

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
});

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
  } catch {
    return "[Unserializable Object]";
  }
}

export const logger = new Proxy(baseLogger, {
  get(target, prop, receiver) {
    if (prop === "info") {
      return (arg1: any, arg2?: string) => {
        baseLogger.info(arg1, arg2);
        const msg = typeof arg1 === "string" ? arg1 : (arg2 || safeStringify(arg1));
        const meta = typeof arg1 === "object" ? arg1 : undefined;
        addLogEntry("info", msg, meta);
      };
    }
    if (prop === "warn") {
      return (arg1: any, arg2?: string) => {
        baseLogger.warn(arg1, arg2);
        const msg = typeof arg1 === "string" ? arg1 : (arg2 || safeStringify(arg1));
        const meta = typeof arg1 === "object" ? arg1 : undefined;
        addLogEntry("warn", msg, meta);
      };
    }
    if (prop === "error") {
      return (arg1: any, arg2?: string) => {
        baseLogger.error(arg1, arg2);
        const msg = typeof arg1 === "string" ? arg1 : (arg2 || (arg1?.err?.message ?? safeStringify(arg1)));
        const meta = typeof arg1 === "object" ? arg1 : undefined;
        addLogEntry("error", msg, meta);
      };
    }
    if (prop === "debug") {
      return (arg1: any, arg2?: string) => {
        baseLogger.debug(arg1, arg2);
        const msg = typeof arg1 === "string" ? arg1 : (arg2 || safeStringify(arg1));
        const meta = typeof arg1 === "object" ? arg1 : undefined;
        addLogEntry("debug", msg, meta);
      };
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === "function") {
      return val.bind(target);
    }
    return val;
  }
}) as any;

