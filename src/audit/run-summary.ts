export type AgentOfficeRunOutcome = "failed" | "skipped" | "succeeded";

export type AgentOfficeRunSummary = {
  briefGenerated: boolean;
  dryRun: boolean;
  error?: string;
  finishedAt: string;
  notionWriteback: boolean;
  outcome: AgentOfficeRunOutcome;
  reason?: string;
  runId: string;
  startedAt: string;
  statusUpdated: boolean;
  taskId: string;
  taskName?: string;
  workflow: "architect-review";
};

export function createRunId(now = new Date()): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `run_${now.toISOString().replace(/[-:.TZ]/g, "")}_${random}`;
}
