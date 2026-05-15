import { describe, expect, it, vi } from "vitest";

import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { ArchitectBrief } from "../../src/domain/architect-brief.js";
import type { ReadyArchitectureTask } from "../../src/domain/ready-architecture-task.js";
import {
  createAgentOfficeApp,
  type ApprovedArchitectBriefWriter,
  type ArchitectReviewWorkflow,
  type ReadyArchitectureTaskScanner,
} from "../../src/server/app.js";
import type { WorkflowResult } from "../../src/workflows/workflow-result.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "11111111-1111-1111-1111-111111111111";
const readyTask: ReadyArchitectureTask = {
  name: "Test task",
  priority: "High",
  status: "Ready for Architecture",
  taskId: pageId,
};

const brief: ArchitectBrief = {
  briefTitle: "Orchestrator API v0",
  configuration: [],
  dependencies: [],
  executiveSummary: "Expose the existing Architect workflow through a minimal HTTP API.",
  fileStructure: ["src/server/app.ts"],
  implementationPlan: ["Validate request", "Run workflow", "Return JSON result"],
  openQuestions: [],
  recommendedArchitecture: ["Keep the API layer thin and delegate to the workflow."],
  risks: [],
};

function workflowSuccess(dryRun: boolean): WorkflowResult {
  return {
    brief,
    dryRun,
    ok: true,
    pageId,
    statusUpdated: !dryRun,
    title: "Test task",
    wroteToNotion: !dryRun,
  };
}

function createWorkflow(result: WorkflowResult) {
  return {
    run: vi.fn<ArchitectReviewWorkflow["run"]>().mockResolvedValue(result),
  };
}

function createApprovedWriter(result: WorkflowResult) {
  return {
    writeApprovedBrief: vi.fn<ApprovedArchitectBriefWriter["writeApprovedBrief"]>().mockResolvedValue(result),
  };
}

function createScanner(input: { hasArchitectBrief?: boolean; tasks?: ReadyArchitectureTask[] } = {}) {
  return {
    findReadyForArchitectureTasks: vi
      .fn<ReadyArchitectureTaskScanner["findReadyForArchitectureTasks"]>()
      .mockResolvedValue(input.tasks ?? [readyTask]),
    hasArchitectBrief: vi
      .fn<ReadyArchitectureTaskScanner["hasArchitectBrief"]>()
      .mockResolvedValue(input.hasArchitectBrief ?? false),
  };
}

function createTestApp(
  input: {
    apiKey?: string;
    approvalSecret?: string;
    approvedWriter?: ReturnType<typeof createApprovedWriter>;
    runLog?: InMemoryRunLog;
    scanner?: ReturnType<typeof createScanner>;
    workflow?: ReturnType<typeof createWorkflow>;
  } = {},
) {
  return createAgentOfficeApp({
    apiKey: input.apiKey ?? apiKey,
    approvalSecret: input.approvalSecret ?? approvalSecret,
    approvedBriefWriter: input.approvedWriter ?? createApprovedWriter(workflowSuccess(false)),
    readyArchitectureScanner: input.scanner ?? createScanner(),
    runLog: input.runLog,
    statusAfterWriteback: "Ready for Codex",
    workflow: input.workflow ?? createWorkflow(workflowSuccess(true)),
  });
}

describe("Agent Office API", () => {
  it("returns public service health without an API key", async () => {
    const app = createTestApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "chief-of-staff-agent-office",
      status: "healthy",
    });

    await app.close();
  });

  it("serves the Operator Console without an API key", async () => {
    const app = createTestApp();

    const response = await app.inject({ method: "GET", url: "/office" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Operator Console v0");

    await app.close();
  });

  it("rejects ready task requests without an API key", async () => {
    const scanner = createScanner();
    const app = createTestApp({ scanner });

    const response = await app.inject({ method: "GET", url: "/agent-office/tasks/ready-for-architecture" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized.", ok: false });
    expect(scanner.findReadyForArchitectureTasks).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects architect review requests with an invalid API key", async () => {
    const workflow = createWorkflow(workflowSuccess(true));
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ runLog, workflow });

    const response = await app.inject({
      headers: { "x-agent-office-api-key": "wrong-key" },
      method: "POST",
      payload: { dryRun: true, taskId: pageId },
      url: "/agent-office/architect-review",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized.", ok: false });
    expect(workflow.run).not.toHaveBeenCalled();
    expect(runLog.records).toHaveLength(0);

    await app.close();
  });

  it("rejects architect review requests without a taskId", async () => {
    const workflow = createWorkflow({
      error: { message: "should not run" },
      ok: false,
    });
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ runLog, workflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: true },
      url: "/agent-office/architect-review",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ ok: false });
    expect(response.json().error).toContain("taskId");
    expect(workflow.run).not.toHaveBeenCalled();
    expect(runLog.records).toHaveLength(0);

    await app.close();
  });

  it("runs the Architect workflow in dry-run mode, returns an approval token, and records a run summary", async () => {
    const workflow = createWorkflow(workflowSuccess(true));
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ runLog, workflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: true, taskId: pageId },
      url: "/agent-office/architect-review",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(workflow.run).toHaveBeenCalledWith({
      dryRun: true,
      pageId,
      statusAfterWriteback: "Ready for Codex",
    });
    expect(body).toMatchObject({
      approval: {
        action: "architect-brief-writeback",
        briefHash: expect.any(String),
        expiresAt: expect.any(String),
        previewRunId: expect.any(String),
        token: expect.any(String),
      },
      brief,
      briefGenerated: true,
      dryRun: true,
      ok: true,
      run: {
        briefGenerated: true,
        dryRun: true,
        notionWriteback: false,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        taskName: "Test task",
        workflow: "architect-review",
      },
      statusUpdated: false,
      taskId: pageId,
    });
    expect(body.run.runId).toEqual(expect.any(String));
    expect(body.approval.previewRunId).toBe(body.run.runId);
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("approves the exact previewed brief without rerunning the model", async () => {
    const workflow = createWorkflow(workflowSuccess(true));
    const approvedWriter = createApprovedWriter(workflowSuccess(false));
    const scanner = createScanner();
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ approvedWriter, runLog, scanner, workflow });

    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: true, taskId: pageId },
      url: "/agent-office/architect-review",
    });
    const previewBody = previewResponse.json();

    const approveResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: previewBody.approval.token },
      url: "/agent-office/architect-review/approve",
    });
    const approveBody = approveResponse.json();

    expect(approveResponse.statusCode).toBe(200);
    expect(workflow.run).toHaveBeenCalledOnce();
    expect(scanner.hasArchitectBrief).toHaveBeenCalledWith(pageId);
    expect(approvedWriter.writeApprovedBrief).toHaveBeenCalledWith({
      brief,
      pageId,
      statusAfterWriteback: "Ready for Codex",
      taskName: "Test task",
    });
    expect(approveBody).toMatchObject({
      approval: {
        briefHash: previewBody.approval.briefHash,
        expiresAt: previewBody.approval.expiresAt,
        previewRunId: previewBody.run.runId,
      },
      briefGenerated: true,
      dryRun: false,
      ok: true,
      run: {
        dryRun: false,
        notionWriteback: true,
        outcome: "succeeded",
        statusUpdated: true,
        taskId: pageId,
        taskName: "Test task",
      },
      statusUpdated: true,
      taskId: pageId,
    });
    expect(runLog.records).toEqual([previewBody.run, approveBody.run]);

    await app.close();
  });

  it("rejects invalid approval tokens without writing", async () => {
    const approvedWriter = createApprovedWriter(workflowSuccess(false));
    const app = createTestApp({ approvedWriter });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: "not-a-real-token" },
      url: "/agent-office/architect-review/approve",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid approval token.", ok: false });
    expect(approvedWriter.writeApprovedBrief).not.toHaveBeenCalled();

    await app.close();
  });

  it("skips approved writeback when an Architect Brief already exists", async () => {
    const workflow = createWorkflow(workflowSuccess(true));
    const approvedWriter = createApprovedWriter(workflowSuccess(false));
    const scanner = createScanner({ hasArchitectBrief: true });
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ approvedWriter, runLog, scanner, workflow });

    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: true, taskId: pageId },
      url: "/agent-office/architect-review",
    });
    const previewBody = previewResponse.json();

    const approveResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: previewBody.approval.token },
      url: "/agent-office/architect-review/approve",
    });
    const approveBody = approveResponse.json();

    expect(approveResponse.statusCode).toBe(409);
    expect(approvedWriter.writeApprovedBrief).not.toHaveBeenCalled();
    expect(approveBody).toMatchObject({
      error: "Architect Brief already exists on task page.",
      ok: false,
      run: {
        dryRun: false,
        notionWriteback: false,
        outcome: "skipped",
        reason: "Architect Brief already exists on task page.",
        statusUpdated: false,
        taskId: pageId,
        taskName: "Test task",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([previewBody.run, approveBody.run]);

    await app.close();
  });

  it("returns and records a clear workflow error response", async () => {
    const workflow = createWorkflow({
      error: { message: "Notion page not found" },
      ok: false,
      pageId,
    });
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ runLog, workflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: false, taskId: pageId },
      url: "/agent-office/architect-review",
    });
    const body = response.json();

    expect(response.statusCode).toBe(500);
    expect(body).toMatchObject({
      error: "Notion page not found",
      ok: false,
      run: {
        dryRun: false,
        error: "Notion page not found",
        notionWriteback: false,
        outcome: "failed",
        statusUpdated: false,
        taskId: pageId,
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("lists tasks ready for architecture with a valid API key", async () => {
    const scanner = createScanner();
    const app = createTestApp({ scanner });

    const response = await app.inject({
      headers: authHeaders,
      method: "GET",
      url: "/agent-office/tasks/ready-for-architecture",
    });

    expect(response.statusCode).toBe(200);
    expect(scanner.findReadyForArchitectureTasks).toHaveBeenCalledOnce();
    expect(response.json()).toEqual({
      ok: true,
      tasks: [readyTask],
    });

    await app.close();
  });

  it("runs ready architecture tasks in dry-run mode and records per-task summaries", async () => {
    const scanner = createScanner();
    const workflow = createWorkflow(workflowSuccess(true));
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ runLog, scanner, workflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: true },
      url: "/agent-office/run-ready-architecture",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(scanner.hasArchitectBrief).not.toHaveBeenCalled();
    expect(workflow.run).toHaveBeenCalledWith({
      dryRun: true,
      pageId,
      statusAfterWriteback: "Ready for Codex",
    });
    expect(body).toMatchObject({
      dryRun: true,
      ok: true,
      runs: [
        {
          dryRun: true,
          notionWriteback: false,
          outcome: "succeeded",
          statusUpdated: false,
          taskId: pageId,
          taskName: "Test task",
        },
      ],
      summary: { failed: 0, processed: 1, skipped: 0 },
    });
    expect(runLog.records).toEqual(body.runs);

    await app.close();
  });

  it("records skipped real writebacks when an Architect Brief already exists", async () => {
    const scanner = createScanner({ hasArchitectBrief: true });
    const workflow = createWorkflow(workflowSuccess(false));
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ runLog, scanner, workflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { dryRun: false },
      url: "/agent-office/run-ready-architecture",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(scanner.hasArchitectBrief).toHaveBeenCalledWith(pageId);
    expect(workflow.run).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      dryRun: false,
      ok: true,
      runs: [
        {
          dryRun: false,
          notionWriteback: false,
          outcome: "skipped",
          reason: "Architect Brief already exists on task page.",
          statusUpdated: false,
          taskId: pageId,
          taskName: "Test task",
        },
      ],
      summary: { failed: 0, processed: 0, skipped: 1 },
    });
    expect(runLog.records).toEqual(body.runs);

    await app.close();
  });
});
