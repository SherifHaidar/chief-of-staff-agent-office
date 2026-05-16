import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ImplementationProposalSchema, type ImplementationProposal } from "../domain/implementation-proposal.js";

export const IMPLEMENTATION_APPROVAL_ACTION = "implementation-branch-draft-pr";
export const IMPLEMENTATION_APPROVAL_TTL_MINUTES = 120;

const ImplementationApprovalPayloadSchema = z
  .object({
    action: z.literal(IMPLEMENTATION_APPROVAL_ACTION),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    previewRunId: z.string().min(1),
    proposal: ImplementationProposalSchema,
    proposalHash: z.string().min(1),
  })
  .strict();

export type ImplementationApprovalPayload = z.infer<typeof ImplementationApprovalPayloadSchema>;

export type SignedImplementationApproval = {
  action: typeof IMPLEMENTATION_APPROVAL_ACTION;
  createdAt: string;
  expiresAt: string;
  previewRunId: string;
  proposalHash: string;
  token: string;
};

export class ImplementationApprovalTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImplementationApprovalTokenError";
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

export function hashImplementationProposal(proposal: ImplementationProposal): string {
  return createHash("sha256").update(stableSerialize(ImplementationProposalSchema.parse(proposal)), "utf8").digest("hex");
}

export function createImplementationApproval(input: {
  now?: Date;
  previewRunId: string;
  proposal: ImplementationProposal;
  secret: string;
  ttlMinutes?: number;
}): SignedImplementationApproval {
  const createdAt = input.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMinutes ?? IMPLEMENTATION_APPROVAL_TTL_MINUTES) * 60_000);
  const proposal = ImplementationProposalSchema.parse(input.proposal);
  const payload: ImplementationApprovalPayload = {
    action: IMPLEMENTATION_APPROVAL_ACTION,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    previewRunId: input.previewRunId,
    proposal,
    proposalHash: hashImplementationProposal(proposal),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, input.secret);

  return {
    action: IMPLEMENTATION_APPROVAL_ACTION,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    previewRunId: payload.previewRunId,
    proposalHash: payload.proposalHash,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyImplementationApproval(input: {
  now?: Date;
  secret: string;
  token: string;
}): ImplementationApprovalPayload {
  const [encodedPayload, signature, ...extra] = input.token.split(".");

  if (!encodedPayload || !signature || extra.length > 0) {
    throw new ImplementationApprovalTokenError("Invalid approval token.");
  }

  const expectedSignature = sign(encodedPayload, input.secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new ImplementationApprovalTokenError("Invalid approval token.");
  }

  let payload: ImplementationApprovalPayload;
  try {
    const parsedJson = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    payload = ImplementationApprovalPayloadSchema.parse(parsedJson);
  } catch {
    throw new ImplementationApprovalTokenError("Invalid approval token.");
  }

  if (payload.proposalHash !== hashImplementationProposal(payload.proposal)) {
    throw new ImplementationApprovalTokenError("Invalid approval token.");
  }

  const now = input.now ?? new Date();
  if (now.getTime() > new Date(payload.expiresAt).getTime()) {
    throw new ImplementationApprovalTokenError("Approval token expired.");
  }

  return payload;
}
