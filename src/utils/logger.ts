export type LogMeta = Record<string, unknown>;

export type Logger = {
  debug(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
};

function write(level: "debug" | "error" | "info" | "warn", message: string, meta?: LogMeta): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${level}] ${message}${payload}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const consoleLogger: Logger = {
  debug: (message, meta) => write("debug", message, meta),
  error: (message, meta) => write("error", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
};

export const silentLogger: Logger = {
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};
