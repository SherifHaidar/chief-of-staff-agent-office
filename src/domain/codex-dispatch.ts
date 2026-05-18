import { z } from "zod";

import type { AiBuildTask } from "./ai-build-task.js";
import { normalizeNotionPageId } from "../utils/ids.js";

export const CODEX_DISPATCH_RECORDED_STATUS = "Codex @codex dispatch comment posted";
export const CODEX_DISPATCH_NEXT_GATE = "Review + Iteration Desk";
export const CODEX_DISPATCH_AWAITING_STATUS = "awaiting Codex response";
export const CODEX_DISPATCH_BOT_LOGIN_FRAGMENT = "codex";
export const DIRECT_CODEX_DISPATCH_UNAVAILABLE =
  "Direct OpenAI API/CLI dispatch remains out of scope; GitHub @codex PR comments are the v0 dispatch path.";

export const CodexDispatchInputSchema = z
  .object({
    pullRequestNumber: z.number().int().positive(),
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repository must be owner/name"),
    taskId: z.string().trim().min(1),
  })
  .strict();

export type CodexDispatchInput = z.infer<typeof CodexDispatchInputSchema>;

export const CodexDispatchStatusInputSchema = CodexDispatchInputSchema.extend({
  dispatchCommentCreatedAt: z.string().datetime(),
  dispatchCommentId: z.number().int().positive().optional(),
}).strict();

export type CodexDispatchStatusInput = z.infer<typeof CodexDispatchStatusInputSchema>;

export const CodexDispatchPullRequestEvidenceSchema = z
  .object({
    baseBranch: z.string().min(1),
    baseCommitSha: z.string().min(1).optional(),
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

export type CodexDispatchPullRequestEvidence = z.infer<typeof CodexDispatchPullRequestEvidenceSchema>;

export const CodexDispatchWorkOrderSummarySchema = z
  .object({
    acceptanceChecklist: z.array(z.string().min(1)).default([]),
    constraints: z.array(z.string().min(1)).default([]),
    implementationScope: z.array(z.string().min(1)).default([]),
    implementationSteps: z.array(z.string().min(1)).default([]),
    problemSummary: z.string().optional(),
    productIntent: z.string().optional(),
    testsToRun: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type CodexDispatchWorkOrderSummary = z.infer<typeof CodexDispatchWorkOrderSummarySchema>;

export const CodexDispatchWorkOrderEvidenceSchema = z
  .object({
    baseBranch: z.string().min(1).optional(),
    baseCommitSha: z.string().min(1).optional(),
    branchName: z.string().min(1).optional(),
    draftPrTitle: z.string().min(1).optional(),
    markdown: z.string().min(1),
    notionUrl: z.string().url().optional(),
    path: z.string().min(1),
    repository: z.string().min(1).optional(),
    summary: CodexDispatchWorkOrderSummarySchema,
    taskId: z.string().min(1).optional(),
    taskName: z.string().min(1).optional(),
    workOrderPath: z.string().min(1).optional(),
  })
  .strict();

export type CodexDispatchWorkOrderEvidence = z.infer<typeof CodexDispatchWorkOrderEvidenceSchema>;

export const CodexDispatchEvidenceSchema = z
  .object({
    collectedAt: z.string().datetime(),
    pullRequest: CodexDispatchPullRequestEvidenceSchema,
    workOrder: CodexDispatchWorkOrderEvidenceSchema,
  })
  .strict();

export type CodexDispatchEvidence = z.infer<typeof CodexDispatchEvidenceSchema>;

export const CodexDispatchPacketSchema = z
  .object({
    markdown: z.string().min(1),
    nextAction: z.string().min(1),
    safetyBoundaries: z.array(z.string().min(1)),
    title: z.string().min(1),
  })
  .strict();

export type CodexDispatchPacket = z.infer<typeof CodexDispatchPacketSchema>;

export const CodexDispatchCommentSchema = z
  .object({
    body: z.string().min(1),
    fallbackPrompt: z.string().min(1),
    title: z.string().min(1),
  })
  .strict();

export type CodexDispatchComment = z.infer<typeof CodexDispatchCommentSchema>;

export const CodexDispatchPostedCommentSchema = z
  .object({
    author: z.string().min(1),
    body: z.string().min(1),
    createdAt: z.string().datetime(),
    id: z.number().int().positive(),
    url: z.string().url(),
  })
  .strict();

export type CodexDispatchPostedComment = z.infer<typeof CodexDispatchPostedCommentSchema>;

export const CodexDispatchSignalSchema = z
  .object({
    actor: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    summary: z.string().min(1),
    type: z.enum(["codex_comment", "codex_review", "codex_task", "commit"]),
    url: z.string().url().optional(),
  })
  .strict();

export type CodexDispatchSignal = z.infer<typeof CodexDispatchSignalSchema>;

export const CodexDispatchStatusReportSchema = z
  .object({
    checkedAt: z.string().datetime(),
    dispatchCommentCreatedAt: z.string().datetime(),
    dispatchCommentId: z.number().int().positive().optional(),
    label: z.enum([
      "awaiting Codex response",
      "Codex responded/reviewed",
      "Codex created a task",
      "Codex pushed/applied commits",
    ]),
    signals: z.array(CodexDispatchSignalSchema),
    summary: z.string().min(1),
  })
  .strict();

export type CodexDispatchStatusReport = z.infer<typeof CodexDispatchStatusReportSchema>;

export const CodexDispatchPlanSchema = z
  .object({
    githubDispatch: z
      .object({
        message: z.string().min(1),
        status: z.enum(["ready_to_post", "comment_posted"]),
      })
      .strict(),
    dispatchMarker: z.string().min(1),
    duplicateMarkerCount: z.number().int().min(0),
    markerAlreadyExists: z.boolean(),
    proposedNextAction: z.string().min(1),
    proposedRecordStatus: z.literal(CODEX_DISPATCH_RECORDED_STATUS),
    writeTargets: z.array(z.string().min(1)),
  })
  .strict();

export type CodexDispatchPlan = z.infer<typeof CodexDispatchPlanSchema>;

export const CodexDispatchDiagnosticsSchema = z
  .object({
    githubDispatch: z.string().min(1),
    githubVerification: z.string().min(1),
    idempotency: z.string().min(1),
    metadataValidation: z.string().min(1),
    notionTaskTarget: z.string().min(1),
  })
  .strict();

export type CodexDispatchDiagnostics = z.infer<typeof CodexDispatchDiagnosticsSchema>;

export const CodexDispatchResultBaseSchema = z
  .object({
    diagnostics: CodexDispatchDiagnosticsSchema,
    evidence: CodexDispatchEvidenceSchema,
    generatedAt: z.string().datetime(),
    input: CodexDispatchInputSchema,
    comment: CodexDispatchCommentSchema,
    notionTask: z
      .object({
        currentStatus: z.string().optional(),
        pageId: z.string().min(1),
        title: z.string().min(1),
        url: z.string().url().optional(),
      })
      .strict(),
    packet: CodexDispatchPacketSchema,
    plan: CodexDispatchPlanSchema,
  })
  .strict();

export const CodexDispatchPreviewSchema = CodexDispatchResultBaseSchema.extend({
  recorded: z.literal(false),
}).strict();

export const CodexDispatchRecordResultSchema = CodexDispatchResultBaseSchema.extend({
  blockAppended: z.boolean(),
  codexStatus: CodexDispatchStatusReportSchema,
  postedComment: CodexDispatchPostedCommentSchema,
  recorded: z.literal(true),
}).strict();

export type CodexDispatchPreview = z.infer<typeof CodexDispatchPreviewSchema>;
export type CodexDispatchRecordResult = z.infer<typeof CodexDispatchRecordResultSchema>;
export type CodexDispatchResult = CodexDispatchPreview | CodexDispatchRecordResult;

export class CodexDispatchValidationError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "CodexDispatchValidationError";
  }
}

function asLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLineValue(markdown: string, label: string): string | undefined {
  const pattern = new RegExp(`^-\\s+${escapeRegExp(label)}:\\s*(.+?)\\s*$`, "im");
  const value = markdown.match(pattern)?.[1]?.trim();

  return value || undefined;
}

function extractSection(markdown: string, heading: string): string | undefined {
  const pattern = new RegExp(`^###\\s+${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=\\n###\\s+|\\n##\\s+|(?![\\s\\S]))`, "im");
  const value = markdown.match(pattern)?.[1]?.trim();

  return value || undefined;
}

function parseBulletSection(markdown: string, heading: string): string[] {
  const section = extractSection(markdown, heading);
  if (!section) {
    return [];
  }

  return asLines(section)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== "none.");
}

function parseTextSection(markdown: string, heading: string): string | undefined {
  const section = extractSection(markdown, heading);
  if (!section) {
    return undefined;
  }

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("- "))
    .join("\n")
    .trim() || undefined;
}

function normalizeRepo(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

function sameRepository(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && normalizeRepo(left) === normalizeRepo(right));
}

function countMarker(content: string, marker: string): number {
  if (!content || !marker) {
    return 0;
  }

  return content.split(marker).length - 1;
}

export function countCodexDispatchMarker(content: string, marker: string): number {
  return countMarker(content, marker);
}

function listMarkdown(items: string[], fallback = "- None."): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

export function parseCodexDispatchWorkOrder(input: { markdown: string; path: string }): CodexDispatchWorkOrderEvidence {
  const summary: CodexDispatchWorkOrderSummary = {
    acceptanceChecklist: parseBulletSection(input.markdown, "Acceptance Checklist"),
    constraints: parseBulletSection(input.markdown, "Constraints / Do Not Change"),
    implementationScope: parseBulletSection(input.markdown, "Implementation Scope"),
    implementationSteps: parseBulletSection(input.markdown, "Implementation Steps"),
    problemSummary: parseTextSection(input.markdown, "Problem Summary"),
    productIntent: parseTextSection(input.markdown, "Product Intent"),
    testsToRun: parseBulletSection(input.markdown, "Tests to Run"),
  };

  return CodexDispatchWorkOrderEvidenceSchema.parse({
    baseBranch: extractLineValue(input.markdown, "Base branch"),
    baseCommitSha: extractLineValue(input.markdown, "Base commit"),
    branchName: extractLineValue(input.markdown, "Branch"),
    draftPrTitle: extractLineValue(input.markdown, "Draft PR title"),
    markdown: input.markdown,
    notionUrl: extractLineValue(input.markdown, "Notion URL"),
    path: input.path,
    repository: extractLineValue(input.markdown, "Repository"),
    summary,
    taskId: extractLineValue(input.markdown, "Task ID"),
    taskName: extractLineValue(input.markdown, "Task name"),
    workOrderPath: extractLineValue(input.markdown, "Work order path"),
  });
}

export function createCodexDispatchMarker(evidence: CodexDispatchEvidence): string {
  return `codex-dispatch:${evidence.pullRequest.repository}#${evidence.pullRequest.pullRequestNumber}:${evidence.pullRequest.headSha}`;
}

export function createCodexDispatchComment(input: { evidence: CodexDispatchEvidence }): CodexDispatchComment {
  const { pullRequest, workOrder } = input.evidence;
  const fallbackPrompt = [
    `Work on PR #${pullRequest.pullRequestNumber} in ${pullRequest.repository}.`,
    "",
    "Branch:",
    pullRequest.headBranch,
    "",
    "Start by reading:",
    workOrder.path,
    "",
    "Implement the work order on this branch only.",
    "",
    "Do not merge.",
    "Do not deploy.",
    "Do not switch repo or branch.",
    "When done, report changed files, tests, CI/Vercel status, and blockers.",
  ].join("\n");
  const body = [
    "@codex implement this work order on this PR branch.",
    "",
    `Repo: ${pullRequest.repository}`,
    `Branch: ${pullRequest.headBranch}`,
    `PR: #${pullRequest.pullRequestNumber}`,
    "",
    "Read:",
    workOrder.path,
    "",
    "Work only on this branch.",
    "Do not merge.",
    "Do not deploy.",
    "Do not switch repo or branch.",
    "After implementation, report changed files, tests, CI/Vercel status, and blockers.",
  ].join("\n");

  return CodexDispatchCommentSchema.parse({
    body,
    fallbackPrompt,
    title: `@codex dispatch comment: ${pullRequest.repository}#${pullRequest.pullRequestNumber}`,
  });
}

export function createCodexDispatchPacket(input: {
  evidence: CodexDispatchEvidence;
  request: CodexDispatchInput;
  task: AiBuildTask;
}): CodexDispatchPacket {
  const { pullRequest, workOrder } = input.evidence;
  const summary = workOrder.summary;
  const safetyBoundaries = [
    `Work only in ${pullRequest.repository}.`,
    `Use branch ${pullRequest.headBranch} and PR #${pullRequest.pullRequestNumber}.`,
    `Start by reading ${workOrder.path}.`,
    "Do not merge.",
    "Do not deploy production.",
    "Do not switch repositories or branches unless Sherif explicitly redirects.",
    "After implementation and tests, send the PR to Review + Iteration Desk before human approval.",
  ];
  const nextAction = `Post the previewed @codex comment to ${pullRequest.repository}#${pullRequest.pullRequestNumber}, then await Codex response evidence. After implementation and tests, send the PR to ${CODEX_DISPATCH_NEXT_GATE}.`;
  const markdown = [
    "# Codex Dispatch Packet",
    "",
    "Audit packet prepared by Agent Office. The primary v0 dispatch path is the short GitHub @codex PR comment.",
    "",
    "## Target",
    `- Repository: ${pullRequest.repository}`,
    `- Implementation branch: ${pullRequest.headBranch}`,
    `- Pull request: #${pullRequest.pullRequestNumber} (${pullRequest.url})`,
    `- PR title: ${pullRequest.title}`,
    `- Base: ${pullRequest.baseBranch}${pullRequest.baseCommitSha ? ` @ ${pullRequest.baseCommitSha}` : ""}`,
    `- Head SHA at preview: ${pullRequest.headSha}`,
    `- Work order file: ${workOrder.path}`,
    "",
    "## Notion Task",
    `- Task: ${input.task.title}`,
    `- Task ID: ${normalizeNotionPageId(input.task.pageId)}`,
    ...(input.task.url ? [`- Notion URL: ${input.task.url}`] : []),
    ...(input.task.status ? [`- Current status: ${input.task.status}`] : []),
    "",
    "## Scope Summary",
    `Problem: ${summary.problemSummary ?? "Not provided in work order."}`,
    "",
    `Product intent: ${summary.productIntent ?? "Not provided in work order."}`,
    "",
    "### Implementation Scope",
    listMarkdown(summary.implementationScope),
    "",
    "### Constraints / Do Not Change",
    listMarkdown(summary.constraints),
    "",
    "### Tests to Run",
    listMarkdown(summary.testsToRun),
    "",
    "### Acceptance Checklist",
    listMarkdown(summary.acceptanceChecklist),
    "",
    "## Safety Boundaries",
    listMarkdown(safetyBoundaries),
    "",
    "## Next Gate",
    nextAction,
  ].join("\n");

  return CodexDispatchPacketSchema.parse({
    markdown,
    nextAction,
    safetyBoundaries,
    title: `Codex Dispatch Audit Packet: ${pullRequest.repository}#${pullRequest.pullRequestNumber}`,
  });
}

function validateDispatchMetadata(input: {
  evidence: CodexDispatchEvidence;
  request: CodexDispatchInput;
  task: AiBuildTask;
}): void {
  const issues: string[] = [];
  const { pullRequest, workOrder } = input.evidence;
  const requestTaskId = normalizeNotionPageId(input.request.taskId);
  const taskPageId = normalizeNotionPageId(input.task.pageId);
  const workOrderTaskId = workOrder.taskId ? normalizeNotionPageId(workOrder.taskId) : undefined;

  if (pullRequest.state !== "open") {
    issues.push(`Pull request must be open. Current state: ${pullRequest.state}.`);
  }

  if (!sameRepository(pullRequest.repository, input.request.repository)) {
    issues.push(`Selected repository ${input.request.repository} does not match pull request repository ${pullRequest.repository}.`);
  }

  if (workOrder.repository && !sameRepository(workOrder.repository, pullRequest.repository)) {
    issues.push(`Work order repository ${workOrder.repository} does not match pull request repository ${pullRequest.repository}.`);
  }

  if (!workOrder.repository) {
    issues.push("Work order is missing Repository metadata.");
  }

  if (workOrder.branchName && workOrder.branchName !== pullRequest.headBranch) {
    issues.push(`Work order branch ${workOrder.branchName} does not match pull request branch ${pullRequest.headBranch}.`);
  }

  if (!workOrder.branchName) {
    issues.push("Work order is missing Branch metadata.");
  }

  if (workOrder.workOrderPath && workOrder.workOrderPath !== workOrder.path) {
    issues.push(`Work order metadata path ${workOrder.workOrderPath} does not match fetched path ${workOrder.path}.`);
  }

  if (!workOrder.workOrderPath) {
    issues.push("Work order is missing Work order path metadata.");
  }

  if (requestTaskId !== taskPageId) {
    issues.push(`Selected task ID ${requestTaskId} does not match fetched Notion task ${taskPageId}.`);
  }

  if (!workOrderTaskId) {
    issues.push("Work order is missing Task ID metadata.");
  } else if (workOrderTaskId !== taskPageId) {
    issues.push(`Work order task ID ${workOrderTaskId} does not match selected Notion task ${taskPageId}.`);
  }

  if (issues.length > 0) {
    throw new CodexDispatchValidationError(`Codex Dispatch metadata validation failed: ${issues.join(" ")}`);
  }
}

export function createCodexDispatchPlan(input: {
  evidence: CodexDispatchEvidence;
  request: CodexDispatchInput;
  task: AiBuildTask;
}): { packet: CodexDispatchPacket; plan: CodexDispatchPlan } {
  validateDispatchMetadata(input);
  const packet = createCodexDispatchPacket(input);
  const marker = createCodexDispatchMarker(input.evidence);
  const duplicateMarkerCount = countMarker(input.task.contentMarkdown, marker);

  return {
    packet,
    plan: CodexDispatchPlanSchema.parse({
      githubDispatch: {
        message: `Preview ready. Confirmation will post the @codex comment to ${input.evidence.pullRequest.repository}#${input.evidence.pullRequest.pullRequestNumber} and record the comment URL in Notion.`,
        status: "ready_to_post",
      },
      dispatchMarker: marker,
      duplicateMarkerCount,
      markerAlreadyExists: duplicateMarkerCount > 0,
      proposedNextAction: packet.nextAction,
      proposedRecordStatus: CODEX_DISPATCH_RECORDED_STATUS,
      writeTargets: [
        `GitHub PR comment on ${input.evidence.pullRequest.repository}#${input.evidence.pullRequest.pullRequestNumber}`,
        `Notion task page block for ${input.task.title}`,
      ],
    }),
  };
}

export function createCodexDispatchDiagnostics(input: {
  evidence: CodexDispatchEvidence;
  plan: CodexDispatchPlan;
  task: AiBuildTask;
}): CodexDispatchDiagnostics {
  return {
    githubDispatch: input.plan.githubDispatch.message,
    githubVerification: `work-order PR verified at ${input.evidence.pullRequest.url} on branch ${input.evidence.pullRequest.headBranch}`,
    idempotency:
      input.plan.duplicateMarkerCount > 1
        ? `dispatch marker found ${input.plan.duplicateMarkerCount} times`
        : input.plan.markerAlreadyExists
          ? "dispatch marker already exists; record will not post a duplicate @codex comment"
          : "dispatch marker not present; @codex comment can be posted",
    metadataValidation: "selected task, work-order file, repository, branch, and PR metadata match",
    notionTaskTarget: `${input.task.title} (${normalizeNotionPageId(input.task.pageId)})`,
  };
}

export function createCodexDispatchPreview(input: {
  evidence: CodexDispatchEvidence;
  generatedAt: Date;
  packet: CodexDispatchPacket;
  plan: CodexDispatchPlan;
  request: CodexDispatchInput;
  task: AiBuildTask;
}): CodexDispatchPreview {
  return CodexDispatchPreviewSchema.parse({
    comment: createCodexDispatchComment({ evidence: input.evidence }),
    diagnostics: createCodexDispatchDiagnostics({ evidence: input.evidence, plan: input.plan, task: input.task }),
    evidence: input.evidence,
    generatedAt: input.generatedAt.toISOString(),
    input: input.request,
    notionTask: {
      ...(input.task.status ? { currentStatus: input.task.status } : {}),
      pageId: normalizeNotionPageId(input.task.pageId),
      title: input.task.title,
      ...(input.task.url ? { url: input.task.url } : {}),
    },
    packet: input.packet,
    plan: input.plan,
    recorded: false,
  });
}

export function createCodexDispatchRecordResult(input: {
  blockAppended: boolean;
  codexStatus: CodexDispatchStatusReport;
  duplicateMarkerCount: number;
  generatedAt: Date;
  markerAlreadyExists: boolean;
  postedComment: CodexDispatchPostedComment;
  preview: CodexDispatchPreview;
}): CodexDispatchRecordResult {
  const plan = {
    ...input.preview.plan,
    duplicateMarkerCount: input.duplicateMarkerCount,
    githubDispatch: {
      message: `@codex comment posted to ${input.postedComment.url}. Awaiting Codex response evidence.`,
      status: "comment_posted" as const,
    },
    markerAlreadyExists: input.markerAlreadyExists,
  };

  return CodexDispatchRecordResultSchema.parse({
    ...input.preview,
    blockAppended: input.blockAppended,
    codexStatus: input.codexStatus,
    generatedAt: input.generatedAt.toISOString(),
    plan,
    postedComment: input.postedComment,
    recorded: true,
  });
}

export function createInitialCodexDispatchStatus(input: {
  checkedAt: Date;
  postedComment: CodexDispatchPostedComment;
}): CodexDispatchStatusReport {
  return CodexDispatchStatusReportSchema.parse({
    checkedAt: input.checkedAt.toISOString(),
    dispatchCommentCreatedAt: input.postedComment.createdAt,
    dispatchCommentId: input.postedComment.id,
    label: CODEX_DISPATCH_AWAITING_STATUS,
    signals: [],
    summary: "The @codex dispatch comment was posted. Awaiting Codex response evidence from GitHub.",
  });
}

export class DisabledDirectCodexDispatcher {
  async dispatch(): Promise<{ message: string; status: "unavailable_not_configured" }> {
    return {
      message: DIRECT_CODEX_DISPATCH_UNAVAILABLE,
      status: "unavailable_not_configured",
    };
  }
}
