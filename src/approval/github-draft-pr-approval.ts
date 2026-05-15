import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { GitHubDraftPrProposalSchema, type GitHubDraftPrProposal } from "../domain/github-draft-pr.js";

export const GITHUB_DRAFT_PR_APPROVAL_ACTION = "github-draft-pr-create";
export const GITHUB_DRAFT_PR_APPROVAL_TTL_MINUTES = 120;

const GitHubDraftPrApprovalPayloadSchema = z
  .object({
    action: z.literal(GITHUB_DRAFT_PR_APPROVAL_ACTION),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    previewRunId: z.string().min(1),
    proposal: GitHubDraftPrProposalSchema,
    proposalHash: z.string().min(1),
  })
  .strict();

export type GitHubDraftPrApprovalPayload = z.infer<typeof GitHubDraftPrApprovalPayloadSchema>;

export type SignedGitHubDraftPrApproval = {
  action: typeof GITHUB_DRAFT_PR_APPROVAL_ACTION;
  createdAt: string;
  expiresAt: string;
  previewRunId: string;
  proposalHash: string;
  token: string;
};

export class GitHubDraftPrApprovalTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubDraftPrApprovalTokenError";
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

export function hashGitHubDraftPrProposal(proposal: GitHubDraftPrProposal): string {
  return createHash("sha256").update(stableSerialize(GitHubDraftPrProposalSchema.parse(proposal)), "utf8").digest("hex");
}

export function createGitHubDraftPrApproval(input: {
  now?: Date;
  previewRunId: string;
  proposal: GitHubDraftPrProposal;
  secret: string;
  ttlMinutes?: number;
}): SignedGitHubDraftPrApproval {
  const createdAt = input.now ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMinutes ?? GITHUB_DRAFT_PR_APPROVAL_TTL_MINUTES) * 60_000);
  const proposal = GitHubDraftPrProposalSchema.parse(input.proposal);
  const payload: GitHubDraftPrApprovalPayload = {
    action: GITHUB_DRAFT_PR_APPROVAL_ACTION,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    previewRunId: input.previewRunId,
    proposal,
    proposalHash: hashGitHubDraftPrProposal(proposal),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encodedPayload, input.secret);

  return {
    action: GITHUB_DRAFT_PR_APPROVAL_ACTION,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    previewRunId: payload.previewRunId,
    proposalHash: payload.proposalHash,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyGitHubDraftPrApproval(input: {
  now?: Date;
  secret: string;
  token: string;
}): GitHubDraftPrApprovalPayload {
  const [encodedPayload, signature, ...extra] = input.token.split(".");

  if (!encodedPayload || !signature || extra.length > 0) {
    throw new GitHubDraftPrApprovalTokenError("Invalid approval token.");
  }

  const expectedSignature = sign(encodedPayload, input.secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new GitHubDraftPrApprovalTokenError("Invalid approval token.");
  }

  let payload: GitHubDraftPrApprovalPayload;
  try {
    const parsedJson = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    payload = GitHubDraftPrApprovalPayloadSchema.parse(parsedJson);
  } catch {
    throw new GitHubDraftPrApprovalTokenError("Invalid approval token.");
  }

  if (payload.proposalHash !== hashGitHubDraftPrProposal(payload.proposal)) {
    throw new GitHubDraftPrApprovalTokenError("Invalid approval token.");
  }

  const now = input.now ?? new Date();
  if (now.getTime() > new Date(payload.expiresAt).getTime()) {
    throw new GitHubDraftPrApprovalTokenError("Approval token expired.");
  }

  return payload;
}
