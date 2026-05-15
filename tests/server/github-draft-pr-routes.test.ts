import { describe, expect, it, vi } from "vitest";

import { createCodexHandoffApproval } from "../../src/approval/codex-handoff-approval.js";
import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { ArchitectBrief } from "../../src/domain/architect-brief.js";
import type { CodexHandoffBrief } from "../../src/domain/codex-handoff-brief.js";
import type { GitHubDraftPrExecutionResult, GitHubDraftPrProposal } from "../../src/domain/github-draft-pr.js";
import {
  createAgentOfficeApp,
  type ApprovedGitHubDraftPrWriter,
  type GitHubDraftPrWorkflowRunner,
  type ReadyCodexTaskScanner,
} from "../../src/server/app.js";
import type { GitHubDraftPrWorkflowResult } from "../../src/workflows/github-draft-pr.workflow.js";
import type { WorkflowResult } from "../../src/workflows/workflow-result.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "22222222-2222-2222-2222-222222222222";
const targetProductRepo = "SherifHaidar/personal-chief-of-staff";

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
  likelyAffectedFiles: ["Confirm during implementation."],
  problemSummary: "Task capture needs improvement.",
  productIntent: "Make capture smoother.",
  suggestedBranchName: "codex/improve-task-capture",
  suggestedPrBody: "## Summary\n- Improve capture",
  suggestedPrTitle: "Improve task capture",
  targetProductRepo,
  testsToRun: ["npm test"],
};

const proposal: GitHubDraftPrProposal = {
  baseBranch: "main",
  baseCommitSha: "base-sha",
  branchName: "agent-office/improve-task-capture-22222222",
  commitMessage: "Add Agent Office handoff for Improve task capture",
  draft: true,
  handoffFileContent: "# Agent Office Codex Handoff\n\nDraft only.",
  handoffFilePath: ".agent-office/handoffs/22222222-2222-2222-2222-222222222222.md",
  prBody: "## Agent Office Draft PR\n\nDraft only.",
  prTitle: "[Draft] Improve task capture",
  repository: targetProductRepo,
  taskId: pageId,
  taskName: "Improve task capture",
};

const githubResult: GitHubDraftPrExecutionResult = {
  baseBranch: "main",
  baseCommitSha: "base-sha",
  branchName: proposal.branchName,
  commitSha: "commit-sha",
  draft: true,
  handoffFilePath: proposal.handoffFilePath,
  pullRequestNumber: 42,
  pullRequestUrl: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/42",
  repository: targetProductRepo,
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

function previewSuccess(): GitHubDraftPrWorkflowResult {
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

function executionSuccess(): GitHubDraftPrWorkflowResult {
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
    now: new Date("2026-05-15T12:00:00.000Z"),
    previewRunId: "run_codex_preview",
    secret: approvalSecret,
    statusAfterWriteback: "In Codex",
    targetProductRepo,
    taskId: pageId,
    taskName: "Improve task capture",
  }).token;
}

function createGitHubWorkflow(result: GitHubDraftPrWorkflowResult) {
  return {
    preview: vi.fn<GitHubDraftPrWorkflowRunner["preview"]>().mockResolvedValue(result),
  };
}

function createGitHubWriter(result: GitHubDraftPrWorkflowResult) {
  return {
    createApprovedDraftPr: vi.fn<ApprovedGitHubDraftPrWriter["createApprovedDraftPr"]>().mockResolvedValue(result),
  };
}

function createReadyCodexScanner(hasCodexHandoffBrief = true) {
  return {
    findReadyForCodexTasks: vi.fn<ReadyCodexTaskScanner["findReadyForCodexTasks"]>().mockResolvedValue([]),
    hasCodexHandoffBrief: vi.fn<ReadyCodexTaskScanner["hasCodexHandoffBrief"]>().mockResolvedValue(hasCodexHandoffBrief),
  };
}

function createTestApp(
  input: {
    githubWorkflow?: ReturnType<typeof createGitHubWorkflow>;
    githubWriter?: ReturnType<typeof createGitHubWriter>;
    readyCodexScanner?: ReturnType<typeof createReadyCodexScanner>;
    runLog?: InMemoryRunLog;
  } = {},
) {
  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: { writeApprovedBrief: vi.fn().mockResolvedValue(architectSuccess()) },
    approvedCodexHandoffWriter: { writeApprovedHandoff: vi.fn() },
    approvedGitHubDraftPrWriter: input.githubWriter ?? createGitHubWriter(executionSuccess()),
    codexHandoffWorkflow: { run: vi.fn() },
    githubDraftPrWorkflow: input.githubWorkflow ?? createGitHubWorkflow(previewSuccess()),
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

describe("GitHub Draft PR Prep API", () => {
  it("previews an exact GitHub Draft PR proposal after Codex Handoff writeback", async () => {
    const githubWorkflow = createGitHubWorkflow(previewSuccess());
    const readyCodexScanner = createReadyCodexScanner(true);
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ githubWorkflow, readyCodexScanner, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { codexHandoffApprovalToken: createCodexToken() },
      url: "/agent-office/github/draft-pr",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(readyCodexScanner.hasCodexHandoffBrief).toHaveBeenCalledWith(pageId);
    expect(githubWorkflow.preview).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        handoff,
        taskId: pageId,
        taskName: "Improve task capture",
      }),
    });
    expect(body).toMatchObject({
      approval: {
        action: "github-draft-pr-create",
        expiresAt: expect.any(String),
        previewRunId: expect.any(String),
        proposalHash: expect.any(String),
        token: expect.any(String),
      },
      dryRun: true,
      githubDraftPrProposalGenerated: true,
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
        workflow: "github-draft-pr-prep",
      },
      taskId: pageId,
    });
    expect(body.approval.previewRunId).toBe(body.run.runId);
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("requires an approved Codex Handoff marker before previewing GitHub writes", async () => {
    const githubWorkflow = createGitHubWorkflow(previewSuccess());
    const readyCodexScanner = createReadyCodexScanner(false);
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ githubWorkflow, readyCodexScanner, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { codexHandoffApprovalToken: createCodexToken() },
      url: "/agent-office/github/draft-pr",
    });
    const body = response.json();

    expect(response.statusCode).toBe(409);
    expect(githubWorkflow.preview).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      error: "Codex Handoff Brief must be approved and written to Notion before GitHub Draft PR Prep.",
      ok: false,
      run: {
        dryRun: true,
        notionWriteback: false,
        outcome: "skipped",
        reason: "Codex Handoff Brief must be approved and written to Notion before GitHub Draft PR Prep.",
        statusUpdated: false,
        workflow: "github-draft-pr-prep",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("approves the exact GitHub Draft PR proposal without regenerating it", async () => {
    const githubWorkflow = createGitHubWorkflow(previewSuccess());
    const githubWriter = createGitHubWriter(executionSuccess());
    const runLog = new InMemoryRunLog();
    const app = createTestApp({ githubWorkflow, githubWriter, runLog });

    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { codexHandoffApprovalToken: createCodexToken() },
      url: "/agent-office/github/draft-pr",
    });
    const previewBody = previewResponse.json();

    const approveResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: previewBody.approval.token },
      url: "/agent-office/github/draft-pr/approve",
    });
    const approveBody = approveResponse.json();

    expect(approveResponse.statusCode).toBe(200);
    expect(githubWorkflow.preview).toHaveBeenCalledOnce();
    expect(githubWriter.createApprovedDraftPr).toHaveBeenCalledWith({ proposal });
    expect(approveBody).toMatchObject({
      approval: {
        expiresAt: previewBody.approval.expiresAt,
        previewRunId: previewBody.run.runId,
        proposalHash: previewBody.approval.proposalHash,
      },
      dryRun: false,
      github: githubResult,
      githubDraftPrCreated: true,
      ok: true,
      run: {
        briefGenerated: true,
        dryRun: false,
        notionWriteback: true,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        taskName: "Improve task capture",
        workflow: "github-draft-pr-prep",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([previewBody.run, approveBody.run]);

    await app.close();
  });

  it("rejects invalid GitHub Draft PR approval tokens without writing", async () => {
    const githubWriter = createGitHubWriter(executionSuccess());
    const app = createTestApp({ githubWriter });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: { approvalToken: "not-a-real-token" },
      url: "/agent-office/github/draft-pr/approve",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid approval token.", ok: false });
    expect(githubWriter.createApprovedDraftPr).not.toHaveBeenCalled();

    await app.close();
  });
});
