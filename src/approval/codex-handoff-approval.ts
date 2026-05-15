import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { CodexHandoffBriefSchema, type CodexHandoffBrief } from "../domain/codex-handoff-brief.js";

export const CODEX_HANDOFF_APPROVAL_ACTION = "codex-handoff-writeback";
export const CODEX_HANDOFF_APPROVAL_TTL_MINUTES = 120;

const CodexHandoffApprovalPayloadSchema = z
  .object({
    action: z.literal(CODEX_HANDOFF_APPROVAL_ACTION),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    handoff: CodexHandoffBriefSchema,
    handoffHash: z.string().min(1),
    previewRunId: z.string().min(1),
    statusAfterWriteback: z.string().min(1).optional(),
    targetProductRepo: z.string().min(1),
    taskId: z.string().min(1),
    taskName: z.string().min(1).optional(),
  })
  .strict();

export type CodexHandoffApprovalPayload = z.infer<typeof CodexHandoffApprovalPayloadSchema>;

export type SignedCodexHandoffApproval = {
  action: typeof CODEX_HANDOFF_APPROVAL_ACTION;
  createdAt: string;
  expiresAt: string;
  handoffHash: string;
  previewRunId: string;
  token: string;
};

export class CodexHandoffApprovalTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexHandoffApprovalTokenError";
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

export function hashCodexHandoffBrief(handoff: CodexHandoffBrief): string {
  return createHash("sha256").update(stableSerialize(CodexHandoffBriefSchema.parse(handoff)), "utf8").digest("hex");
}

export function createCodexHandoffApproval(input: {
  handoff: CodexHandoffBrief;
  now?: Date;
  previewRunId: string;
  secret: string;
  statusAfterWriteback?: string;
  targetProductRepo: string;
  taskId: string;
  taskName?: string;
  ttlMinutes?: number;
}): SignedCodexHandoffApproval {
  const createdAt = input.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMinutes ?? CODEX_HANDOFF_APPROVAL_TTL_MINUTES) * 60_000);
  const handoff = CodexHandoffBriefSchema.parse(input.handoff);
  const payload: CodexHandoffApprovalPayload = {
    action: CODEX_HANDOFF_APPROVAL_ACTION,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    handoff,
    handoffHash: hashCodexHandoffBrief(handoff),
    previewRunId: input.previewRunId,
    targetProductRepo: input.targetProductRepo,
    taskId: input.taskId,
    ...(input.statusAfterWriteback ? { statusAfterWriteback: input.statusAfterWriteback } : {}),
    ...(input.taskName ? { taskName: input.taskName } : {}),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, input.secret);

  return {
    action: CODEX_HANDOFF_APPROVAL_ACTION,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    handoffHash: payload.handoffHash,
    previewRunId: payload.previewRunId,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyCodexHandoffApproval(input: {
  now?: Date;
  secret: string;
  token: string;
}): CodexHandoffApprovalPayload {
  const [encodedPayload, signature, ...extra] = input.token.split(".");

  if (!encodedPayload || !signature || extra.length > 0) {
    throw new CodexHandoffApprovalTokenError("Invalid approval token.");
  }

  const expectedSignature = sign(encodedPayload, input.secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new CodexHandoffApprovalTokenError("Invalid approval token.");
  }

  let payload: CodexHandoffApprovalPayload;
  try {
    const parsedJson = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    payload = CodexHandoffApprovalPayloadSchema.parse(parsedJson);
  } catch {
    throw new CodexHandoffApprovalTokenError("Invalid approval token.");
  }

  if (payload.handoffHash !== hashCodexHandoffBrief(payload.handoff)) {
    throw new CodexHandoffApprovalTokenError("Invalid approval token.");
  }

  const now = input.now ?? new Date();
  if (now.getTime() > new Date(payload.expiresAt).getTime()) {
    throw new CodexHandoffApprovalTokenError("Approval token expired.");
  }

  return payload;
}
