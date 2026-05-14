import { z } from "zod";

export const ArchitectBriefSchema = z
  .object({
    briefTitle: z.string().min(1).describe("Short title for the brief."),
    configuration: z
      .array(z.string().min(1))
      .describe("Required credentials, environment variables, permissions, and setup notes. Use an empty array if none."),
    dependencies: z
      .array(z.string().min(1))
      .describe("Runtime or development dependencies that should be added. Use an empty array if none."),
    executiveSummary: z.string().min(1).describe("Concise summary of the recommended approach."),
    fileStructure: z.array(z.string().min(1)).describe("Proposed files and folders for the implementation."),
    implementationPlan: z.array(z.string().min(1)).describe("Ordered implementation steps."),
    openQuestions: z.array(z.string().min(1)).describe("Questions that need human confirmation. Use an empty array if none."),
    recommendedArchitecture: z.array(z.string().min(1)).describe("Architectural decisions and boundaries."),
    risks: z.array(z.string().min(1)).describe("Risks, tradeoffs, and mitigations. Use an empty array if none."),
  })
  .strict();

export type ArchitectBrief = z.infer<typeof ArchitectBriefSchema>;
