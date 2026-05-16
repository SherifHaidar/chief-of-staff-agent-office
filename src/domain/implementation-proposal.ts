import { z } from "zod";

export const IMPLEMENTATION_PENDING_NOTICE =
  "Implementation pending — this is the starting point for Codex implementation, not the final deliverable.";

export const IMPLEMENTATION_NEXT_ACTION =
  "Codex must implement on this branch, run relevant tests, and return evidence before human merge or deploy approval.";

export const ImplementationHandoffSummarySchema = z
  .object({
    acceptanceChecklist: z.array(z.string().min(1)),
    constraints: z.array(z.string().min(1)),
    implementationScope: z.array(z.string().min(1)),
    implementationSteps: z.array(z.string().min(1)),
    likelyAffectedFiles: z.array(z.string().min(1)),
    problemSummary: z.string().min(1),
    productIntent: z.string().min(1),
    suggestedBranchName: z.string().min(1),
    suggestedPrTitle: z.string().min(1),
    testsToRun: z.array(z.string().min(1)),
  })
  .strict();

export type ImplementationHandoffSummary = z.infer<typeof ImplementationHandoffSummarySchema>;

export const ImplementationProposalSchema = z
  .object({
    approvalWarnings: z.array(z.string().min(1)),
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1),
    branchName: z.string().min(1),
    commitMessage: z.string().min(1),
    draft: z.literal(true),
    handoffSummary: ImplementationHandoffSummarySchema,
    nextAction: z.string().min(1),
    prBody: z.string().min(1),
    prTitle: z.string().min(1),
    repository: z.string().min(1),
    taskId: z.string().min(1),
    taskName: z.string().min(1),
    workOrderContent: z.string().min(1),
    workOrderPath: z.string().min(1),
  })
  .strict();

export type ImplementationProposal = z.infer<typeof ImplementationProposalSchema>;

export const GitHubCheckSummarySchema = z
  .object({
    completedAt: z.string().datetime().optional(),
    conclusion: z.string().min(1).nullable().optional(),
    detailsUrl: z.string().url().optional(),
    name: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

export type GitHubCheckSummary = z.infer<typeof GitHubCheckSummarySchema>;

export const ImplementationExecutionResultSchema = z
  .object({
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1),
    branchName: z.string().min(1),
    checks: z.array(GitHubCheckSummarySchema),
    commitSha: z.string().min(1),
    draft: z.literal(true),
    nextAction: z.string().min(1),
    pullRequestNumber: z.number().int().positive(),
    pullRequestUrl: z.string().url(),
    repository: z.string().min(1),
    workOrderPath: z.string().min(1),
  })
  .strict();

export type ImplementationExecutionResult = z.infer<typeof ImplementationExecutionResultSchema>;
