import { describe, expect, it, vi } from "vitest";

import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { ArchitectBrief } from "../../src/domain/architect-brief.js";
import type { CodexHandoffBrief } from "../../src/domain/codex-handoff-brief.js";
import type { ReadyArchitectureTask } from "../../src/domain/ready-architecture-task.js";
import {
  createAgentOfficeApp,
  type ApprovedCodexHandoffWriter,
  type CodexHandoffWorkflowRunner,
  type ReadyCodexTaskScanner,
} from "../../src/server/app.js";
import type { CodexHandoffWorkflowResult } from "../../src/workflows/codex-handoff.workflow.js";
import type { WorkflowResult } from "../../src/workflows/workflow-result.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "22222222-2222-2222-2222-222222222222";
const targetProductRepo = "SherifHaidar/personal-chief-of-staff";
const readyCodexTask: ReadyArchitectureTask = {
  name: "Improve Chief of Staff task capture",
  priority: "P1",
  status: "Ready for Codex",
  taskId: pageId,
};

const architectBrief: ArchitectBrief = {
  briefTitle: "Existing architect stub",
  configuration: [],
  dependencies: [],
  executiveSummary: "Stub only.",
  fileStructure: [],
  implementationPlan: [],
  openQuestions: [],
  recommendedArchitecture: [],
  risks: [],
};

const handoff: CodexHandoffBrief = {
  acceptanceChecklist: ["Task capture improvement is visible in the Chief of Staff app."],
  constraints: ["Do not change unrelated onboarding or deployment settings."],
  explicitApprovalWarnings: ["Merge requires Sherif approval.", "Deployment requires Sherif approval."],
  implementationScope: ["Implement the scoped product improvement described by the Notion task."],
  implementationSteps: ["Inspect the relevant product code", "Make the smallest safe change", "Run tests"],
  likelyAffectedFiles: ["Confirm affected Chief of Staff app modules during implementation."],
  problemSummary: "Task capture needs a focused product improvement.",
  productIntent: "Make the Chief of Staff app more useful without changing unrelated behavior.",
  suggestedBranchName: "codex/improve-task-capture",
  suggestedPrBody: "## Summary\n- Improve task capture\n\n## Testing\n- npm test",
  suggestedPrTitle: "Improve Chief of Staff task capture",
  targetProductRepo,
  testsToRun: ["npm test"],
};

function architectSuccess(): WorkflowResult {
  return {
    brief: architectBrief,
    dryRun: true,
    ok: true,
    pageId,
    statusUpdated: false,
    title: "Architect stub",
    wroteToNotion: false,
  };
}

function handoffSuccess(dryRun: boolean): CodexHandoffWorkflowResult {
  return {
    dryRun,
    handoff,
    ok: true,
    pageId,
    statusUpdated: !dryRun,
    targetProductRepo,
    title: readyCodexTask.name,
    wroteToNotion: !dryRun,
  };
}

function createCodexWorkflow(result: CodexHandoffWorkflowResult) {
  return {
    run: vi.fn<CodexHandoffWorkflowRunner["run"]>().mockResolvedValue(result),
  };
}

function createCodexWriter(result: CodexHandoffWorkflowResult) {
  return {
    writeApprovedHandoff: vi.fn<ApprovedCodexHandoffWriter["writeApprovedHandoff"]>().mockResolvedValue(result),
  };
}

function createReadyCodexScanner(input: { hasCodexHandoffBrief?: boolean; tasks?: ReadyArchitectureTask[] } = {}) {
  return {
    findReadyForCodexTasks: vi.fn<ReadyCodexTaskScanner["findReadyForCodexTasks"]>().mockResolvedValue(input.tasks ?? [readyCodexTask]),
    hasCodexHandoffBrief: vi
      .fn<ReadyCodexTaskScanner["hasCodexHandoffBrief"]>()
      .mockResolvedValue(input.hasCodexHandoffBrief ?? false),
  };
}

function createTestApp(
  input: {
    codexWorkflow?: ReturnType<typeof createCodexWorkflow>;
    codexWriter?: ReturnType<typeof createCodexWriter>;
    readyCodexScanner?: ReturnType<typeof createReadyCodexScanner>;
    runLog?: InMemoryRunLog;
  } = {},
) {
  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: { writeApprovedBrief: vi.fn().mockResolvedValue(architectSuccess()) },
    approvedCodexHandoffWriter: input.codexWriter ?? createCodexWriter(handoffSuccess(false)),
    codexHandoffWorkflow: input.codexWorkflow ?? createCodexWorkflow(handoffSuccess(true)),
    readyArchitectureScanner: {
      findReadyForArchitectureTasks: vi.fn().mockResolvedValue([]),
      hasArchitectBrief: vi.fn().mockResolvedValue(false),
    },
    readyCodexScanner: input.readyCodexScanner ?? createReadyCodexScanner(),
    runLog: input.runLog,
    statusAfterCodexHandoff: "In Codex",
    statusAfterWriteback: "Ready for Codex",
    targetProductRepo,
    workflow: { run: vi.fn().mockResolvedValue(architectSuccess()) },
  });
}

describe("Implementation Desk API", () => {
  it("lists tasks ready for Codex with a valid API key", async () => {
    const readyCodexScanner = createReadyCodexScanner();
    const app = createTestApp({ readyCodexScanner });

    const response = await app.inject({
      headers: authHeaders,
      method: "GET",
      url: "/agent-office/tasks/ready-for-codex",
    });

    expect(response.statusCode).toBe(200);
    expect(readyCodexScanner.findReadyForCodexTasks).toHaveBeenCalledOnce();
    expect(response.json()).toEqual({ ok: true, tasks: [readyCodexTask] });

    await app.close();
  });

  it("generates a Codex Handoff preview, returns an approval token, and does not write", async () => {
    const codexWorkflow = createCodexWorkflow(handoffSuccess(true));
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ codexWorkflow, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { taskId: pageId },
      url: "/agent-office/codex-handoff",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(codexWorkflow.run).toHaveBeenCalledWith({
      dryRun: true,
      pageId,
      statusAfterWriteback: "In Codex",
      targetProductRepo,
    });
    expect(body).toMatchObject({
      approval: {
        action: "codex-handoff-writeback",
        expiresAt: expect.any(String),
        handoffHash: expect.any(String),
        previewRunId: expect.any(String),
        token: expect.any(String),
      },
      dryRun: true,
      handoff,
      handoffGenerated: true,
      ok: true,
      run: {
        briefGenerated: true,
        dryRun: true,
        notionWriteback: false,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        taskName: readyCodexTask.name,
        workflow: "codex-handoff",
      },
      statusUpdated: false,
      taskId: pageId,
    });
    expect(body.approval.previewRunId).toBe(body.run.runId);
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("approves the exact previewed handoff without rerunning the model", async () => {
    const codexWorkflow = createCodexWorkflow(handoffSuccess(true));
    const codexWriter = createCodexWriter(handoffSuccess(false));
    const readyCodexScanner = createReadyCodexScanner();
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ codexWorkflow, codexWriter, readyCodexScanner, runLog });

    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { taskId: pageId },
      url: "/agent-office/codex-handoff",
    });
    const previewBody = previewResponse.json();

    const approveResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: previewBody.approval.token },
      url: "/agent-office/codex-handoff/approve",
    });
    const approveBody = approveResponse.json();

    expect(approveResponse.statusCode).toBe(200);
    expect(codexWorkflow.run).toHaveBeenCalledOnce();
    expect(readyCodexScanner.hasCodexHandoffBrief).toHaveBeenCalledWith(pageId);
    expect(codexWriter.writeApprovedHandoff).toHaveBeenCalledWith({
      handoff,
      pageId,
      statusAfterWriteback: "In Codex",
      targetProductRepo,
      taskName: readyCodexTask.name,
    });
    expect(approveBody).toMatchObject({
      approval: {
        expiresAt: previewBody.approval.expiresAt,
        handoffHash: previewBody.approval.handoffHash,
        previewRunId: previewBody.run.runId,
      },
      dryRun: false,
      handoffGenerated: true,
      ok: true,
      run: {
        dryRun: false,
        notionWriteback: true,
        outcome: "succeeded",
        statusUpdated: true,
        taskId: pageId,
        taskName: readyCodexTask.name,
        workflow: "codex-handoff",
      },
      statusUpdated: true,
      taskId: pageId,
    });
    expect(runLog.records).toEqual([previewBody.run, approveBody.run]);

    await app.close();
  });

  it("rejects invalid Codex Handoff approval tokens without writing", async () => {
    const codexWriter = createCodexWriter(handoffSuccess(false));
    const app = createTestApp({ codexWriter });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: "not-a-real-token" },
      url: "/agent-office/codex-handoff/approve",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid approval token.", ok: false });
    expect(codexWriter.writeApprovedHandoff).not.toHaveBeenCalled();

    await app.close();
  });

  it("skips approved Codex Handoff writeback when a handoff already exists", async () => {
    const codexWorkflow = createCodexWorkflow(handoffSuccess(true));
    const codexWriter = createCodexWriter(handoffSuccess(false));
    const readyCodexScanner = createReadyCodexScanner({ hasCodexHandoffBrief: true });
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ codexWorkflow, codexWriter, readyCodexScanner, runLog });

    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { taskId: pageId },
      url: "/agent-office/codex-handoff",
    });
    const previewBody = previewResponse.json();

    const approveResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: previewBody.approval.token },
      url: "/agent-office/codex-handoff/approve",
    });
    const approveBody = approveResponse.json();

    expect(approveResponse.statusCode).toBe(409);
    expect(codexWriter.writeApprovedHandoff).not.toHaveBeenCalled();
    expect(approveBody).toMatchObject({
      error: "Codex Handoff Brief already exists on task page.",
      ok: false,
      run: {
        dryRun: false,
        notionWriteback: false,
        outcome: "skipped",
        reason: "Codex Handoff Brief already exists on task page.",
        statusUpdated: false,
        taskId: pageId,
        taskName: readyCodexTask.name,
        workflow: "codex-handoff",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([previewBody.run, approveBody.run]);

    await app.close();
  });
});
