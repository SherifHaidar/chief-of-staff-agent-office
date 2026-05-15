import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ArchitectBriefSchema, type ArchitectBrief } from "../domain/architect-brief.js";

export const ARCHITECT_BRIEF_APPROVAL_ACTION = "architect-brief-writeback";
export const ARCHITECT_BRIEF_APPROVAL_TTL_MINUTES = 120;

const ArchitectBriefApprovalPayloadSchema = z
  .object({
    action: z.literal(ARCHITECT_BRIEF_APPROVAL_ACTION),
    brief: ArchitectBriefSchema,
    briefHash: z.string().min(1),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    previewRunId: z.string().min(1),
    statusAfterWriteback: z.string().min(1),
    taskId: z.string().min(1),
    taskName: z.string().min(1).optional(),
  })
  .strict();

export type ArchitectBriefApprovalPayload = z.infer<typeof ArchitectBriefApprovalPayloadSchema>;

export type SignedArchitectBriefApproval = {
  action: typeof ARCHITECT_BRIEF_APPROVAL_ACTION;
  briefHash: string;
  createdAt: string;
  expiresAt: string;
  previewRunId: string;
  token: string;
};

export class ArchitectBriefApprovalTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchitectBriefApprovalTokenError";
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

  return JSON.stringify(value);
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

export function hashArchitectBrief(brief: ArchitectBrief): string {
  return createHash("sha256").update(stableSerialize(ArchitectBriefSchema.parse(brief)), "utf8").digest("hex");
}

export function createArchitectBriefApproval(input: {
  brief: ArchitectBrief;
  now?: Date;
  previewRunId: string;
  secret: string;
  statusAfterWriteback: string;
  taskId: string;
  taskName?: string;
  ttlMinutes?: number;
}): SignedArchitectBriefApproval {
  const createdAt = input.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMinutes ?? ARCHITECT_BRIEF_APPROVAL_TTL_MINUTES) * 60_000);
  const brief = ArchitectBriefSchema.parse(input.brief);
  const payload: ArchitectBriefApprovalPayload = {
    action: ARCHITECT_BRIEF_APPROVAL_ACTION,
    brief,
    briefHash: hashArchitectBrief(brief),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    previewRunId: input.previewRunId,
    statusAfterWriteback: input.statusAfterWriteback,
    taskId: input.taskId,
    ...(input.taskName ? { taskName: input.taskName } : {}),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, input.secret);

  return {
    action: ARCHITECT_BRIEF_APPROVAL_ACTION,
    briefHash: payload.briefHash,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    previewRunId: payload.previewRunId,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyArchitectBriefApproval(input: {
  now?: Date;
  secret: string;
  token: string;
}): ArchitectBriefApprovalPayload {
  const [encodedPayload, signature, ...extra] = input.token.split(".");

  if (!encodedPayload || !signature || extra.length > 0) {
    throw new ArchitectBriefApprovalTokenError("Invalid approval token.");
  }

  const expectedSignature = sign(encodedPayload, input.secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new ArchitectBriefApprovalTokenError("Invalid approval token.");
  }

  let payload: ArchitectBriefApprovalPayload;
  try {
    const parsedJson = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    payload = ArchitectBriefApprovalPayloadSchema.parse(parsedJson);
  } catch {
    throw new ArchitectBriefApprovalTokenError("Invalid approval token.");
  }

  if (payload.briefHash !== hashArchitectBrief(payload.brief)) {
    throw new ArchitectBriefApprovalTokenError("Invalid approval token.");
  }

  const now = input.now ?? new Date();
  if (now.getTime() > new Date(payload.expiresAt).getTime()) {
    throw new ArchitectBriefApprovalTokenError("Approval token expired.");
  }

  return payload;
}
