import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { CodexDispatchPreviewSchema, type CodexDispatchPreview } from "../domain/codex-dispatch.js";

export const CODEX_DISPATCH_APPROVAL_ACTION = "codex-dispatch-record";
export const CODEX_DISPATCH_APPROVAL_TTL_MINUTES = 120;

const CodexDispatchApprovalPayloadSchema = z
  .object({
    action: z.literal(CODEX_DISPATCH_APPROVAL_ACTION),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    preview: CodexDispatchPreviewSchema,
    previewHash: z.string().min(1),
    previewRunId: z.string().min(1),
  })
  .strict();

export type CodexDispatchApprovalPayload = z.infer<typeof CodexDispatchApprovalPayloadSchema>;

export type SignedCodexDispatchApproval = {
  action: typeof CODEX_DISPATCH_APPROVAL_ACTION;
  createdAt: string;
  expiresAt: string;
  previewHash: string;
  previewRunId: string;
  token: string;
};

export class CodexDispatchApprovalTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexDispatchApprovalTokenError";
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashCodexDispatchPreview(preview: CodexDispatchPreview): string {
  return createHash("sha256").update(stableSerialize(CodexDispatchPreviewSchema.parse(preview)), "utf8").digest("hex");
}

export function createCodexDispatchApproval(input: {
  now?: Date;
  preview: CodexDispatchPreview;
  previewRunId: string;
  secret: string;
  ttlMinutes?: number;
}): SignedCodexDispatchApproval {
  const createdAt = input.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMinutes ?? CODEX_DISPATCH_APPROVAL_TTL_MINUTES) * 60_000);
  const preview = CodexDispatchPreviewSchema.parse(input.preview);
  const payload: CodexDispatchApprovalPayload = {
    action: CODEX_DISPATCH_APPROVAL_ACTION,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    preview,
    previewHash: hashCodexDispatchPreview(preview),
    previewRunId: input.previewRunId,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, input.secret);

  return {
    action: CODEX_DISPATCH_APPROVAL_ACTION,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    previewHash: payload.previewHash,
    previewRunId: payload.previewRunId,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyCodexDispatchApproval(input: {
  now?: Date;
  secret: string;
  token: string;
}): CodexDispatchApprovalPayload {
  const [encodedPayload, signature, ...extra] = input.token.split(".");

  if (!encodedPayload || !signature || extra.length > 0) {
    throw new CodexDispatchApprovalTokenError("Invalid approval token.");
  }

  const expectedSignature = sign(encodedPayload, input.secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new CodexDispatchApprovalTokenError("Invalid approval token.");
  }

  let payload: CodexDispatchApprovalPayload;
  try {
    const parsedJson = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    payload = CodexDispatchApprovalPayloadSchema.parse(parsedJson);
  } catch {
    throw new CodexDispatchApprovalTokenError("Invalid approval token.");
  }

  if (payload.previewHash !== hashCodexDispatchPreview(payload.preview)) {
    throw new CodexDispatchApprovalTokenError("Invalid approval token.");
  }

  const now = input.now ?? new Date();
  if (now.getTime() > new Date(payload.expiresAt).getTime()) {
    throw new CodexDispatchApprovalTokenError("Approval token expired.");
  }

  return payload;
}
