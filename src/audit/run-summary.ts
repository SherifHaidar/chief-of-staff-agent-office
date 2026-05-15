export type AgentOfficeRunOutcome = "failed" | "skipped" | "succeeded";
export type AgentOfficeWorkflow =
  | "architect-review"
  | "architect-review-revision"
  | "codex-handoff"
  | "github-draft-pr-prep";

export type AgentOfficeRunSummary = {
  briefGenerated: boolean;
  dryRun: boolean;
  error?: string;
  finishedAt: string;
  notionWriteback: boolean;
  outcome: AgentOfficeRunOutcome;
  reason?: string;
  revisionFeedbackHash?: string;
  revisionNumber?: number;
  revisionOfPreviewRunId?: string;
  runId: string;
  startedAt: string;
  statusUpdated: boolean;
  taskId: string;
  taskName?: string;
  workflow: AgentOfficeWorkflow;
};

export function createRunId(now = new Date()): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `run_${now.toISOString().replace(/[-:.TZ]/g, "")}_${random}`;
}
