import { z } from "zod";

export const ImplementationFileChangeSchema = z
  .object({
    action: z.enum(["create", "update"]),
    content: z.string().min(1),
    path: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();

export type ImplementationFileChange = z.infer<typeof ImplementationFileChangeSchema>;

export const TaskSpecificVerificationPlanSchema = z
  .object({
    acceptanceCriteria: z.array(z.string().min(1)),
    automatedChecks: z.array(z.string().min(1)),
    evidenceToCollect: z.array(z.string().min(1)),
    manualChecks: z.array(z.string().min(1)),
    regressionRisks: z.array(z.string().min(1)),
  })
  .strict();

export type TaskSpecificVerificationPlan = z.infer<typeof TaskSpecificVerificationPlanSchema>;

export const ImplementationProposalSchema = z
  .object({
    approvalWarnings: z.array(z.string().min(1)),
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1),
    branchName: z.string().min(1),
    changedFiles: z.array(ImplementationFileChangeSchema).min(1).max(8),
    commitMessage: z.string().min(1),
    contextGaps: z.array(z.string().min(1)),
    draft: z.literal(true),
    implementationSummary: z.string().min(1),
    prBody: z.string().min(1),
    prTitle: z.string().min(1),
    repository: z.string().min(1),
    taskId: z.string().min(1),
    taskName: z.string().min(1),
    verificationPlan: TaskSpecificVerificationPlanSchema,
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

export const ImplementationEvidenceSummarySchema = z
  .object({
    automatedChecksSummary: z.string().min(1),
    evidence: z.array(z.string().min(1)),
    verificationGaps: z.array(z.string().min(1)),
  })
  .strict();

export type ImplementationEvidenceSummary = z.infer<typeof ImplementationEvidenceSummarySchema>;

export const ImplementationExecutionResultSchema = z
  .object({
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1),
    branchName: z.string().min(1),
    changedFiles: z.array(
      z
        .object({
          action: z.enum(["create", "update"]),
          path: z.string().min(1),
          summary: z.string().min(1),
        })
        .strict(),
    ),
    checks: z.array(GitHubCheckSummarySchema),
    commitSha: z.string().min(1),
    draft: z.literal(true),
    evidence: ImplementationEvidenceSummarySchema,
    pullRequestNumber: z.number().int().positive(),
    pullRequestUrl: z.string().url(),
    repository: z.string().min(1),
  })
  .strict();

export type ImplementationExecutionResult = z.infer<typeof ImplementationExecutionResultSchema>;
