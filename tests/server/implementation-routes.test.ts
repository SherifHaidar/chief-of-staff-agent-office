import { describe, expect, it, vi } from "vitest";

import { createCodexHandoffApproval } from "../../src/approval/codex-handoff-approval.js";
import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { ArchitectBrief } from "../../src/domain/architect-brief.js";
import type { CodexHandoffBrief } from "../../src/domain/codex-handoff-brief.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../../src/domain/implementation-proposal.js";
import { IMPLEMENTATION_PENDING_NOTICE } from "../../src/domain/implementation-proposal.js";
import {
  createAgentOfficeApp,
  type ApprovedImplementationWriter,
  type ImplementationReadyTaskScanner,
  type ImplementationWorkflowRunner,
  type ReadyCodexTaskScanner,
} from "../../src/server/app.js";
import type { ImplementationWorkflowResult } from "../../src/workflows/implementation.workflow.js";
import type { WorkflowResult } from "../../src/workflows/workflow-result.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "22222222-2222-2222-2222-222222222222";
const targetProductRepo = "SherifHaidar/personal-chief-of-staff";
const implementationReadyTask = {
  name: "Design Tasks DB",
  priority: "P0",
  status: "In Codex",
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
  acceptanceChecklist: ["Task capture improvement is visible."],
  constraints: ["Do not merge or deploy without approval."],
  explicitApprovalWarnings: ["Merge requires Sherif approval.", "Deployment requires Sherif approval."],
  implementationScope: ["Prepare implementation work."],
  implementationSteps: ["Inspect code", "Implement", "Test"],
  likelyAffectedFiles: ["lib/capture.ts"],
  problemSummary: "Task capture needs improvement.",
  productIntent: "Make capture smoother.",
  suggestedBranchName: "codex/improve-task-capture",
  suggestedPrBody: "## Summary\n- Improve capture",
  suggestedPrTitle: "Improve task capture",
  targetProductRepo,
  testsToRun: ["npm test"],
};

const proposal: ImplementationProposal = {
  approvalWarnings: [
    "Implementation pending. This draft PR is a starting point for Codex implementation, not the final deliverable.",
    "Agent Office will commit only the work-order file. Product code changes must happen later on this branch.",
    "Merge and deployment require separate final human approval.",
  ],
  baseBranch: "main",
  baseCommitSha: "base-sha",
  branchName: "agent-office/impl-improve-task-capture-22222222",
  commitMessage: "Add implementation work order for Improve task capture",
  draft: true,
  handoffSummary: {
    acceptanceChecklist: ["Task capture improvement is visible."],
    constraints: ["Do not merge or deploy without approval."],
    implementationScope: ["Prepare implementation work."],
    implementationSteps: ["Inspect code", "Implement", "Test"],
    likelyAffectedFiles: ["lib/capture.ts"],
    problemSummary: "Task capture needs improvement.",
    productIntent: "Make capture smoother.",
    suggestedBranchName: "codex/improve-task-capture",
    suggestedPrTitle: "Improve task capture",
    testsToRun: ["npm test"],
  },
  nextAction: "Codex must implement on this branch, run relevant tests, and return evidence before human merge or deploy approval.",
  prBody: `${IMPLEMENTATION_PENDING_NOTICE}\n\nWork order only.`,
  prTitle: "[Draft] Implementation pending: Improve task capture",
  repository: targetProductRepo,
  taskId: pageId,
  taskName: "Improve task capture",
  workOrderContent: `${IMPLEMENTATION_PENDING_NOTICE}\n\n# Work order\nCodex must implement next.`,
  workOrderPath: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
};

const githubResult: ImplementationExecutionResult = {
  baseBranch: "main",
  baseCommitSha: "base-sha",
  branchName: proposal.branchName,
  checks: [{ conclusion: "success", name: "CI", status: "completed" }],
  commitSha: "commit-sha",
  draft: true,
  nextAction: proposal.nextAction,
  pullRequestNumber: 55,
  pullRequestUrl: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/55",
  repository: targetProductRepo,
  workOrderPath: proposal.workOrderPath,
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

function previewSuccess(): ImplementationWorkflowResult {
  return {
    dryRun: true,
    ok: true,
    pageId,
    proposal,
    statusUpdated: false,
    title: proposal.prTitle,
    wroteToNotion: false,
  };
}

function executionSuccess(): ImplementationWorkflowResult {
  return {
    dryRun: false,
    github: githubResult,
    ok: true,
    pageId,
    proposal,
    statusUpdated: false,
    title: proposal.prTitle,
    wroteToNotion: true,
  };
}

function createCodexToken() {
  return createCodexHandoffApproval({
    handoff,
    now: new Date(),
    previewRunId: "run_codex_preview",
    secret: approvalSecret,
    statusAfterWriteback: "In Codex",
    targetProductRepo,
    taskId: pageId,
    taskName: "Improve task capture",
  }).token;
}

function createImplementationWorkflow(result: ImplementationWorkflowResult) {
  return {
    preview: vi.fn<ImplementationWorkflowRunner["preview"]>().mockResolvedValue(result),
  };
}

function createImplementationWriter(result: ImplementationWorkflowResult) {
  return {
    createApprovedImplementation: vi
      .fn<ApprovedImplementationWriter["createApprovedImplementation"]>()
      .mockResolvedValue(result),
  };
}

function createReadyCodexScanner(hasCodexHandoffBrief = true) {
  return {
    findReadyForCodexTasks: vi.fn<ReadyCodexTaskScanner["findReadyForCodexTasks"]>().mockResolvedValue([]),
    hasCodexHandoffBrief: vi.fn<ReadyCodexTaskScanner["hasCodexHandoffBrief"]>().mockResolvedValue(hasCodexHandoffBrief),
  };
}

function createImplementationReadyScanner(input: { loadFails?: Error } = {}) {
  return {
    findImplementationReadyTasks: vi
      .fn<ImplementationReadyTaskScanner["findImplementationReadyTasks"]>()
      .mockResolvedValue([implementationReadyTask]),
    loadApprovedCodexHandoff: vi
      .fn<ImplementationReadyTaskScanner["loadApprovedCodexHandoff"]>()
      .mockImplementation(async () => {
        if (input.loadFails) {
          throw input.loadFails;
        }

        return {
          handoff,
          status: "In Codex",
          taskId: pageId,
          taskName: implementationReadyTask.name,
        };
      }),
  };
}

function createTestApp(
  input: {
    implementationWorkflow?: ReturnType<typeof createImplementationWorkflow>;
    implementationReadyScanner?: ReturnType<typeof createImplementationReadyScanner>;
    implementationWriter?: ReturnType<typeof createImplementationWriter>;
    readyCodexScanner?: ReturnType<typeof createReadyCodexScanner>;
    runLog?: InMemoryRunLog;
  } = {},
) {
  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: { writeApprovedBrief: vi.fn().mockResolvedValue(architectSuccess()) },
    approvedCodexHandoffWriter: { writeApprovedHandoff: vi.fn() },
    approvedImplementationWriter: input.implementationWriter ?? createImplementationWriter(executionSuccess()),
    codexHandoffWorkflow: { run: vi.fn() },
    implementationReadyScanner: input.implementationReadyScanner ?? createImplementationReadyScanner(),
    implementationWorkflow: input.implementationWorkflow ?? createImplementationWorkflow(previewSuccess()),
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

describe("Controlled Implementation API", () => {
  it("lists implementation-ready In Codex tasks with approved handoffs", async () => {
    const implementationReadyScanner = createImplementationReadyScanner();
    const app = createTestApp({ implementationReadyScanner });

    const response = await app.inject({
      headers: authHeaders,
      method: "GET",
      url: "/agent-office/tasks/implementation-ready",
    });

    expect(response.statusCode).toBe(200);
    expect(implementationReadyScanner.findImplementationReadyTasks).toHaveBeenCalledOnce();
    expect(response.json()).toEqual({ ok: true, tasks: [implementationReadyTask] });

    await app.close();
  });

  it("previews an exact implementation work order after Codex Handoff writeback", async () => {
    const implementationWorkflow = createImplementationWorkflow(previewSuccess());
    const readyCodexScanner = createReadyCodexScanner(true);
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ implementationWorkflow, readyCodexScanner, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { codexHandoffApprovalToken: createCodexToken() },
      url: "/agent-office/github/implementation",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(readyCodexScanner.hasCodexHandoffBrief).toHaveBeenCalledWith(pageId);
    expect(implementationWorkflow.preview).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        handoff,
        taskId: pageId,
        taskName: "Improve task capture",
      }),
    });
    expect(body).toMatchObject({
      approval: {
        action: "implementation-branch-draft-pr",
        expiresAt: expect.any(String),
        previewRunId: expect.any(String),
        proposalHash: expect.any(String),
        token: expect.any(String),
      },
      dryRun: true,
      implementationWorkOrderGenerated: true,
      ok: true,
      proposal,
      run: {
        briefGenerated: true,
        dryRun: true,
        notionWriteback: false,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        taskName: "Improve task capture",
        workflow: "implementation",
      },
      taskId: pageId,
    });
    expect(body.approval.previewRunId).toBe(body.run.runId);
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("previews a work order from a persisted In Codex handoff without a handoff token", async () => {
    const implementationWorkflow = createImplementationWorkflow(previewSuccess());
    const implementationReadyScanner = createImplementationReadyScanner();
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ implementationReadyScanner, implementationWorkflow, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { taskId: pageId },
      url: "/agent-office/github/implementation",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(implementationReadyScanner.loadApprovedCodexHandoff).toHaveBeenCalledWith(pageId);
    expect(implementationWorkflow.preview).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        action: "codex-handoff-writeback",
        handoff,
        previewRunId: expect.stringMatching(/^notion-handoff:/),
        targetProductRepo,
        taskId: pageId,
        taskName: "Design Tasks DB",
      }),
    });
    expect(body).toMatchObject({
      approval: {
        action: "implementation-branch-draft-pr",
        token: expect.any(String),
      },
      dryRun: true,
      implementationWorkOrderGenerated: true,
      ok: true,
      proposal,
      run: {
        dryRun: true,
        notionWriteback: false,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        taskName: "Design Tasks DB",
        workflow: "implementation",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("requires an approved Codex Handoff marker before previewing implementation work orders", async () => {
    const implementationWorkflow = createImplementationWorkflow(previewSuccess());
    const readyCodexScanner = createReadyCodexScanner(false);
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ implementationWorkflow, readyCodexScanner, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { codexHandoffApprovalToken: createCodexToken() },
      url: "/agent-office/github/implementation",
    });
    const body = response.json();

    expect(response.statusCode).toBe(409);
    expect(implementationWorkflow.preview).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      error: "Codex Handoff Brief must be approved and written to Notion before controlled implementation.",
      ok: false,
      run: {
        dryRun: true,
        notionWriteback: false,
        outcome: "skipped",
        reason: "Codex Handoff Brief must be approved and written to Notion before controlled implementation.",
        statusUpdated: false,
        workflow: "implementation",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("approves the exact implementation work order without regenerating it", async () => {
    const implementationWorkflow = createImplementationWorkflow(previewSuccess());
    const implementationWriter = createImplementationWriter(executionSuccess());
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ implementationWorkflow, implementationWriter, runLog });

    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { codexHandoffApprovalToken: createCodexToken() },
      url: "/agent-office/github/implementation",
    });
    const previewBody = previewResponse.json();

    const approveResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: previewBody.approval.token },
      url: "/agent-office/github/implementation/approve",
    });
    const approveBody = approveResponse.json();

    expect(approveResponse.statusCode).toBe(200);
    expect(implementationWorkflow.preview).toHaveBeenCalledOnce();
    expect(implementationWriter.createApprovedImplementation).toHaveBeenCalledWith({ proposal });
    expect(approveBody).toMatchObject({
      approval: {
        expiresAt: previewBody.approval.expiresAt,
        previewRunId: previewBody.run.runId,
        proposalHash: previewBody.approval.proposalHash,
      },
      dryRun: false,
      github: githubResult,
      implementationWorkOrderPrCreated: true,
      ok: true,
      run: {
        briefGenerated: true,
        dryRun: false,
        notionWriteback: true,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        taskName: "Improve task capture",
        workflow: "implementation",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([previewBody.run, approveBody.run]);

    await app.close();
  });

  it("rejects invalid implementation approval tokens without writing", async () => {
    const implementationWriter = createImplementationWriter(executionSuccess());
    const app = createTestApp({ implementationWriter });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: "not-a-real-token" },
      url: "/agent-office/github/implementation/approve",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid approval token.", ok: false });
    expect(implementationWriter.createApprovedImplementation).not.toHaveBeenCalled();

    await app.close();
  });
});
