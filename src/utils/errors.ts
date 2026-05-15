export type SerializedError = {
  message: string;
  name?: string;
  stack?: string;
  statusCode?: number;
};

function extractStatusCode(error: Error): number | undefined {
  if (!("statusCode" in error)) {
    return undefined;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const statusCode = extractStatusCode(error);

    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(statusCode ? { statusCode } : {}),
    };
  }

  return {
    message: String(error),
  };
}
