import { z } from "zod";

export const GitHubDraftPrProposalSchema = z
  .object({
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1),
    branchName: z.string().min(1),
    commitMessage: z.string().min(1),
    draft: z.literal(true),
    handoffFileContent: z.string().min(1),
    handoffFilePath: z.string().min(1),
    prBody: z.string().min(1),
    prTitle: z.string().min(1),
    repository: z.string().min(1),
    taskId: z.string().min(1),
    taskName: z.string().min(1).optional(),
  })
  .strict();

export type GitHubDraftPrProposal = z.infer<typeof GitHubDraftPrProposalSchema>;

export const GitHubDraftPrExecutionResultSchema = z
  .object({
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1),
    branchName: z.string().min(1),
    commitSha: z.string().min(1),
    draft: z.literal(true),
    handoffFilePath: z.string().min(1),
    pullRequestNumber: z.number().int().positive(),
    pullRequestUrl: z.string().url(),
    repository: z.string().min(1),
  })
  .strict();

export type GitHubDraftPrExecutionResult = z.infer<typeof GitHubDraftPrExecutionResultSchema>;
