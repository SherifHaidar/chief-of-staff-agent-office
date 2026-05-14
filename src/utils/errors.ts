export type SerializedError = {
  message: string;
  name?: string;
  stack?: string;
};

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
