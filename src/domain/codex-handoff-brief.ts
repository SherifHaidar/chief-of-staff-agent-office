import { z } from "zod";

export const CodexHandoffBriefSchema = z
  .object({
    acceptanceChecklist: z.array(z.string().min(1)).describe("Specific checks that must pass before the work is considered done."),
    constraints: z.array(z.string().min(1)).describe("Do-not-change guidance, boundaries, and safety constraints."),
    explicitApprovalWarnings: z
      .array(z.string().min(1))
      .describe("Warnings about merge, deploy, data, or product approval gates."),
    implementationScope: z.array(z.string().min(1)).describe("Concrete implementation areas that are in scope."),
    implementationSteps: z.array(z.string().min(1)).describe("Ordered implementation steps for Codex or a developer."),
    likelyAffectedFiles: z
      .array(z.string().min(1))
      .describe("Likely files, modules, or areas affected. Use an empty array if unknown."),
    problemSummary: z.string().min(1).describe("Concise summary of the problem to solve."),
    productIntent: z.string().min(1).describe("User/product outcome the implementation should serve."),
    suggestedBranchName: z.string().min(1).describe("Suggested Git branch name, without creating it."),
    suggestedPrBody: z.string().min(1).describe("Suggested PR description body for future manual or automated use."),
    suggestedPrTitle: z.string().min(1).describe("Suggested PR title."),
    targetProductRepo: z.string().min(1).describe("Owner/name of the product repository to implement against."),
    testsToRun: z.array(z.string().min(1)).describe("Manual or automated tests to run after implementation."),
  })
  .strict();

export type CodexHandoffBrief = z.infer<typeof CodexHandoffBriefSchema>;
