import { z } from "zod";

import type { ProductContextPackSummary } from "./product-context-pack.js";
import type { ArchitectBrief } from "./architect-brief.js";

export const ArchitectureDecisionStatusSchema = z.enum(["Ready for Codex", "Needs Owner Decisions"]);

export type ArchitectureDecisionStatus = z.infer<typeof ArchitectureDecisionStatusSchema>;

export const ArchitectBriefApprovalMetadataSchema = z
  .object({
    contextGaps: z.array(z.string()).default([]),
    decisionStatus: ArchitectureDecisionStatusSchema,
    revisionFeedbackHash: z.string().min(1).optional(),
    revisionNumber: z.number().int().min(1).default(1),
    revisionOfPreviewRunId: z.string().min(1).optional(),
  })
  .strict();

export type ArchitectBriefApprovalMetadata = z.infer<typeof ArchitectBriefApprovalMetadataSchema>;

export type ArchitectBriefWritebackMetadata = ArchitectBriefApprovalMetadata & {
  approvalTimestamp: string;
};

export function deriveArchitectureDecisionStatus(input: {
  brief: ArchitectBrief;
  contextGaps?: string[];
}): ArchitectureDecisionStatus {
  const hasOpenQuestions = input.brief.openQuestions.length > 0;
  const hasContextGaps = (input.contextGaps ?? []).length > 0;

  return hasOpenQuestions || hasContextGaps ? "Needs Owner Decisions" : "Ready for Codex";
}

export function createArchitectBriefApprovalMetadata(input: {
  brief: ArchitectBrief;
  productContext?: ProductContextPackSummary;
  revisionFeedbackHash?: string;
  revisionNumber?: number;
  revisionOfPreviewRunId?: string;
}): ArchitectBriefApprovalMetadata {
  const contextGaps = input.productContext?.contextGaps ?? [];

  return ArchitectBriefApprovalMetadataSchema.parse({
    contextGaps,
    decisionStatus: deriveArchitectureDecisionStatus({ brief: input.brief, contextGaps }),
    ...(input.revisionFeedbackHash ? { revisionFeedbackHash: input.revisionFeedbackHash } : {}),
    revisionNumber: input.revisionNumber ?? 1,
    ...(input.revisionOfPreviewRunId ? { revisionOfPreviewRunId: input.revisionOfPreviewRunId } : {}),
  });
}

export function ownerDecisionNotesForArchitectBrief(input: {
  brief: ArchitectBrief;
  metadata?: ArchitectBriefApprovalMetadata;
}): string[] {
  return [
    ...input.brief.openQuestions,
    ...(input.metadata?.contextGaps ?? []).map((gap) => `Context gap: ${gap}`),
  ];
}
