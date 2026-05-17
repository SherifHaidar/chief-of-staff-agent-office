import { z } from "zod";

export const ReviewDeskVerdictSchema = z.enum(["Needs Codex Fixes", "Ready for Human Smoke Test", "Blocked"]);

export type ReviewDeskVerdict = z.infer<typeof ReviewDeskVerdictSchema>;

export const ReviewDeskInputSchema = z
  .object({
    pullRequestNumber: z.number().int().positive(),
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repository must be owner/name"),
    taskId: z.string().trim().min(1),
  })
  .strict();

export type ReviewDeskInput = z.infer<typeof ReviewDeskInputSchema>;

export const ReviewDeskChangedFileSchema = z
  .object({
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    patch: z.string().optional(),
    patchTruncated: z.boolean().default(false),
    path: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

export type ReviewDeskChangedFile = z.infer<typeof ReviewDeskChangedFileSchema>;

export const ReviewDeskCheckSchema = z
  .object({
    completedAt: z.string().optional(),
    conclusion: z.string().nullable().optional(),
    detailsUrl: z.string().url().optional(),
    name: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

export type ReviewDeskCheck = z.infer<typeof ReviewDeskCheckSchema>;

export const ReviewDeskDeploymentSchema = z
  .object({
    environment: z.string().optional(),
    state: z.string().optional(),
    statuses: z.array(ReviewDeskCheckSchema).default([]),
    url: z.string().url().optional(),
  })
  .strict();

export type ReviewDeskDeployment = z.infer<typeof ReviewDeskDeploymentSchema>;

export const ReviewDeskPullRequestEvidenceSchema = z
  .object({
    author: z.string().optional(),
    baseBranch: z.string().min(1),
    body: z.string(),
    changedFiles: z.array(ReviewDeskChangedFileSchema),
    checks: z.array(ReviewDeskCheckSchema),
    collectionWarnings: z.array(z.string()).default([]),
    deployments: z.array(ReviewDeskDeploymentSchema).default([]),
    draft: z.boolean(),
    headBranch: z.string().min(1),
    headSha: z.string().min(1),
    pullRequestNumber: z.number().int().positive(),
    repository: z.string().min(1),
    state: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

export type ReviewDeskPullRequestEvidence = z.infer<typeof ReviewDeskPullRequestEvidenceSchema>;

export const ReviewDeskWorkOrderEvidenceSchema = z
  .object({
    acceptanceCriteria: z.array(z.string()).default([]),
    contentMarkdown: z.string().default(""),
    pageTitle: z.string().min(1),
    prWorkOrderMarkdown: z.string().optional(),
    prWorkOrderPath: z.string().optional(),
    status: z.string().optional(),
    taskId: z.string().min(1),
    url: z.string().url().optional(),
  })
  .strict();

export type ReviewDeskWorkOrderEvidence = z.infer<typeof ReviewDeskWorkOrderEvidenceSchema>;

export const ReviewDeskFindingSchema = z
  .object({
    message: z.string().min(1),
    severity: z.enum(["blocking", "fixes_needed", "missing_evidence", "info"]),
  })
  .strict();

export type ReviewDeskFinding = z.infer<typeof ReviewDeskFindingSchema>;

export const ReviewDeskEvidencePacketSchema = z
  .object({
    collectedAt: z.string().datetime(),
    input: ReviewDeskInputSchema,
    missingEvidence: z.array(z.string()).default([]),
    policyFindings: z.array(ReviewDeskFindingSchema).default([]),
    pullRequest: ReviewDeskPullRequestEvidenceSchema,
    workOrder: ReviewDeskWorkOrderEvidenceSchema,
  })
  .strict();

export type ReviewDeskEvidencePacket = z.infer<typeof ReviewDeskEvidencePacketSchema>;

export const ReviewDeskChecklistItemSchema = z
  .object({
    criterion: z.string().min(1),
    notes: z.string().min(1),
    status: z.enum(["pass", "fail", "unclear"]),
  })
  .strict();

export type ReviewDeskChecklistItem = z.infer<typeof ReviewDeskChecklistItemSchema>;

export const ReviewDeskCodexFixBriefSchema = z
  .object({
    instructions: z.array(z.string().min(1)).default([]),
    summary: z.string().min(1),
    verification: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type ReviewDeskCodexFixBrief = z.infer<typeof ReviewDeskCodexFixBriefSchema>;

export const ClaudeReviewPacketSchema = z
  .object({
    acceptanceChecklist: z.array(ReviewDeskChecklistItemSchema).default([]),
    codexFixBrief: ReviewDeskCodexFixBriefSchema.optional(),
    missingEvidence: z.array(z.string().min(1)).default([]),
    risks: z.array(z.string().min(1)).default([]),
    suggestedSmokeTests: z.array(z.string().min(1)).default([]),
    summary: z.string().min(1),
    verdict: ReviewDeskVerdictSchema,
  })
  .strict();

export type ClaudeReviewPacket = z.infer<typeof ClaudeReviewPacketSchema>;

export const ReviewDeskResultSchema = z
  .object({
    evidence: ReviewDeskEvidencePacketSchema,
    finalApprovalWarning: z.string().min(1),
    review: ClaudeReviewPacketSchema,
  })
  .strict();

export type ReviewDeskResult = z.infer<typeof ReviewDeskResultSchema>;

export const REVIEW_DESK_FINAL_APPROVAL_WARNING =
  "Review Desk output is not merge approval, deployment approval, or final Sherif approval. Ready for Human Smoke Test means Sherif still needs to test and approve.";

