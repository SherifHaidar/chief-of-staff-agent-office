import { describe, expect, it, vi } from "vitest";

import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { CodexDispatchPreview, CodexDispatchRecordResult } from "../../src/domain/codex-dispatch.js";
import { createAgentOfficeApp, type CodexDispatchWorkflowRunner } from "../../src/server/app.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "364b258f-9a3e-8199-9d57-f6b8d01a099a";

const preview: CodexDispatchPreview = {
  comment: {
    body:
      "@codex implement this work order on this PR branch.\n\nRead:\n.agent-office/work-orders/364b258f-9a3e-8199-9d57-f6b8d01a099a.md",
    fallbackPrompt:
      "Work on PR #22 in SherifHaidar/chief-of-staff-agent-office.\n\nStart by reading:\n.agent-office/work-orders/364b258f-9a3e-8199-9d57-f6b8d01a099a.md",
    title: "@codex dispatch comment: SherifHaidar/chief-of-staff-agent-office#22",
  },
  diagnostics: {
    githubDispatch: "Preview ready. Confirmation will post the @codex comment.",
    githubVerification: "work-order PR verified",
    idempotency: "dispatch marker not present; packet block can be recorded",
    metadataValidation: "selected task, work-order file, repository, branch, and PR metadata match",
    notionTaskTarget: `Add Codex Dispatch v0 (${pageId})`,
  },
  evidence: {
    collectedAt: "2026-05-18T09:00:00.000Z",
    pullRequest: {
      baseBranch: "main",
      baseCommitSha: "base-sha",
      draft: true,
      headBranch: "agent-office/impl-add-codex-dispatch-v0-packet-workflow-364b258f",
      headSha: "head-sha",
      pullRequestNumber: 22,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      state: "open",
      title: "[Draft] Implementation pending: Add Codex Dispatch v0 packet workflow",
      url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22",
    },
    workOrder: {
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-add-codex-dispatch-v0-packet-workflow-364b258f",
      draftPrTitle: "[Draft] Implementation pending: Add Codex Dispatch v0 packet workflow",
      markdown: "# Agent Office Implementation Work Order",
      path: ".agent-office/work-orders/364b258f-9a3e-8199-9d57-f6b8d01a099a.md",
      repository: "SherifHaidar/chief-of-staff-agent-office",
      summary: {
        acceptanceChecklist: ["Preview mode is side-effect-free."],
        constraints: ["Do not merge."],
        implementationScope: ["Prepare deterministic packet."],
        implementationSteps: ["Implement packet workflow."],
        problemSummary: "Add Codex Dispatch v0.",
        productIntent: "Remove manual copy-paste.",
        testsToRun: ["npm test"],
      },
      taskId: pageId,
      taskName: "Add Codex Dispatch v0",
      workOrderPath: ".agent-office/work-orders/364b258f-9a3e-8199-9d57-f6b8d01a099a.md",
    },
  },
  generatedAt: "2026-05-18T09:30:00.000Z",
  input: {
    pullRequestNumber: 22,
    repository: "SherifHaidar/chief-of-staff-agent-office",
    taskId: pageId,
  },
  notionTask: {
    currentStatus: "In Codex",
    pageId,
    title: "Add Codex Dispatch v0",
  },
  packet: {
    markdown: "# Codex Dispatch Packet\n\nPacket prepared by Agent Office.",
    nextAction:
      "Post the previewed @codex comment to SherifHaidar/chief-of-staff-agent-office#22, then await Codex response evidence. After implementation and tests, send the PR to Review + Iteration Desk.",
    safetyBoundaries: ["Do not merge.", "Do not deploy production."],
    title: "Codex Dispatch Audit Packet: SherifHaidar/chief-of-staff-agent-office#22",
  },
  plan: {
    githubDispatch: {
      message: "Preview ready. Confirmation will post the @codex comment.",
      status: "ready_to_post",
    },
    dispatchMarker: "codex-dispatch:SherifHaidar/chief-of-staff-agent-office#22:head-sha",
    duplicateMarkerCount: 0,
    markerAlreadyExists: false,
    proposedNextAction:
      "Post the previewed @codex comment to SherifHaidar/chief-of-staff-agent-office#22, then await Codex response evidence. After implementation and tests, send the PR to Review + Iteration Desk.",
    proposedRecordStatus: "Codex @codex dispatch comment posted",
    writeTargets: [
      "GitHub PR comment on SherifHaidar/chief-of-staff-agent-office#22",
      "Notion task page block for Add Codex Dispatch v0",
    ],
  },
  recorded: false,
};

const recordResult: CodexDispatchRecordResult = {
  ...preview,
  blockAppended: true,
  codexStatus: {
    checkedAt: "2026-05-18T09:30:00.000Z",
    dispatchCommentCreatedAt: "2026-05-18T09:31:00.000Z",
    dispatchCommentId: 123,
    label: "awaiting Codex response",
    signals: [],
    summary: "The @codex dispatch comment was posted. Awaiting Codex response evidence from GitHub.",
  },
  postedComment: {
    author: "sherif-agent-office-orchestrator[bot]",
    body: preview.comment.body,
    createdAt: "2026-05-18T09:31:00.000Z",
    id: 123,
    url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22#issuecomment-123",
  },
  recorded: true as const,
};

function createTestApp(
  input: {
    codexDispatchConfigurationMessage?: string;
    codexDispatchWorkflow?: CodexDispatchWorkflowRunner;
    runLog?: InMemoryRunLog;
  } = {},
) {
  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: { writeApprovedBrief: vi.fn() },
    codexDispatchConfigurationMessage: input.codexDispatchConfigurationMessage,
    codexDispatchWorkflow: input.codexDispatchWorkflow,
    readyArchitectureScanner: {
      findReadyForArchitectureTasks: vi.fn().mockResolvedValue([]),
      hasArchitectBrief: vi.fn().mockResolvedValue(false),
    },
    runLog: input.runLog,
    statusAfterWriteback: "Ready for Codex",
    workflow: { run: vi.fn() },
  });
}

describe("Codex Dispatch API", () => {
  it("prepares a dispatch packet without writeback and returns a record approval token", async () => {
    const runLog = new InMemoryRunLog();
    const codexDispatchWorkflow = {
      preview: vi.fn<CodexDispatchWorkflowRunner["preview"]>().mockResolvedValue({
        dispatch: preview,
        dryRun: true,
        ok: true,
        pageId,
        statusUpdated: false,
        title: preview.packet.title,
        wroteToNotion: false,
      }),
      record: vi.fn<CodexDispatchWorkflowRunner["record"]>(),
      status: vi.fn<CodexDispatchWorkflowRunner["status"]>(),
    };
    const app = createTestApp({ codexDispatchWorkflow, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 22,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/codex-dispatch/preview",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.approval.token).toEqual(expect.any(String));
    expect(body).toMatchObject({
      ok: true,
      preview: {
        recorded: false,
      },
      run: {
        dryRun: true,
        notionWriteback: false,
        workflow: "codex-dispatch",
      },
    });
    expect(codexDispatchWorkflow.record).not.toHaveBeenCalled();
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("refuses to record without explicit approval token confirmation", async () => {
    const codexDispatchWorkflow = {
      preview: vi.fn<CodexDispatchWorkflowRunner["preview"]>(),
      record: vi.fn<CodexDispatchWorkflowRunner["record"]>(),
      status: vi.fn<CodexDispatchWorkflowRunner["status"]>(),
    };
    const app = createTestApp({ codexDispatchWorkflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 22,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/codex-dispatch/record",
    });

    expect(response.statusCode).toBe(400);
    expect(codexDispatchWorkflow.record).not.toHaveBeenCalled();

    await app.close();
  });

  it("records the previewed packet after approval", async () => {
    const codexDispatchWorkflow = {
      preview: vi.fn<CodexDispatchWorkflowRunner["preview"]>().mockResolvedValue({
        dispatch: preview,
        dryRun: true,
        ok: true,
        pageId,
        statusUpdated: false,
        title: preview.packet.title,
        wroteToNotion: false,
      }),
      record: vi.fn<CodexDispatchWorkflowRunner["record"]>().mockResolvedValue({
        dispatch: recordResult,
        dryRun: false,
        ok: true,
        pageId,
        statusUpdated: false,
        title: preview.packet.title,
        wroteToNotion: true,
      }),
      status: vi.fn<CodexDispatchWorkflowRunner["status"]>(),
    };
    const app = createTestApp({ codexDispatchWorkflow });
    const previewResponse = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 22,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/codex-dispatch/preview",
    });
    const approvalToken = previewResponse.json().approval.token;

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        approvalToken,
      },
      url: "/agent-office/codex-dispatch/record",
    });

    expect(response.statusCode).toBe(200);
    expect(codexDispatchWorkflow.record).toHaveBeenCalledWith({
      preview,
    });
    expect(response.json()).toMatchObject({
      ok: true,
      result: {
        recorded: true,
      },
      run: {
        dryRun: false,
        notionWriteback: true,
        workflow: "codex-dispatch",
      },
    });

    await app.close();
  });

  it("returns blocked configuration when Codex Dispatch is not wired", async () => {
    const app = createTestApp({
      codexDispatchConfigurationMessage: "Codex Dispatch is blocked until this configuration is set: GITHUB_APP_ID.",
    });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 22,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/codex-dispatch/preview",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "Codex Dispatch is blocked until this configuration is set: GITHUB_APP_ID.",
      ok: false,
      status: "blocked",
      taskId: pageId,
    });

    await app.close();
  });

  it("refreshes Codex Dispatch status without Notion writeback", async () => {
    const codexDispatchWorkflow = {
      preview: vi.fn<CodexDispatchWorkflowRunner["preview"]>(),
      record: vi.fn<CodexDispatchWorkflowRunner["record"]>(),
      status: vi.fn<CodexDispatchWorkflowRunner["status"]>().mockResolvedValue({
        dryRun: true,
        ok: true,
        pageId,
        status: {
          checkedAt: "2026-05-18T09:40:00.000Z",
          dispatchCommentCreatedAt: "2026-05-18T09:31:00.000Z",
          dispatchCommentId: 123,
          label: "Codex created a task",
          signals: [
            {
              actor: "chatgpt-codex-connector[bot]",
              createdAt: "2026-05-18T09:35:00.000Z",
              summary: "View task",
              type: "codex_task",
              url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22#discussion_r1",
            },
          ],
          summary: "1 GitHub signal found after the @codex dispatch comment.",
        },
        statusUpdated: false,
        title: "Codex Dispatch status: SherifHaidar/chief-of-staff-agent-office#22",
        wroteToNotion: false,
      }),
    };
    const app = createTestApp({ codexDispatchWorkflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        dispatchCommentCreatedAt: "2026-05-18T09:31:00.000Z",
        dispatchCommentId: 123,
        pullRequestNumber: 22,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/codex-dispatch/status",
    });

    expect(response.statusCode).toBe(200);
    expect(codexDispatchWorkflow.status).toHaveBeenCalledWith({
      dispatchCommentCreatedAt: "2026-05-18T09:31:00.000Z",
      dispatchCommentId: 123,
      pullRequestNumber: 22,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });
    expect(response.json()).toMatchObject({
      ok: true,
      status: {
        label: "Codex created a task",
      },
      run: {
        dryRun: true,
        notionWriteback: false,
        workflow: "codex-dispatch",
      },
    });

    await app.close();
  });
});
