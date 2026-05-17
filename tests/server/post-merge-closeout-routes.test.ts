import { describe, expect, it, vi } from "vitest";

import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { PostMergeCloseoutResult } from "../../src/domain/post-merge-closeout.js";
import { createAgentOfficeApp, type PostMergeCloseoutWorkflowRunner } from "../../src/server/app.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "22222222-2222-2222-2222-222222222222";

const closeoutResult: PostMergeCloseoutResult = {
  blockAppended: true,
  committed: true,
  diagnostics: {
    deploymentLookup: "found 1 deployment record(s)",
    githubVerification: "merged PR verified at 2026-05-17T11:00:00.000Z with merge SHA merge-sha",
    idempotency: "marker not present; closeout block can be appended",
    notionTaskTarget: `Post-Merge Closeout v0 (${pageId})`,
    properties: ["Status: planned select update"],
    taskPrLink: "Selected Notion task PR Link matches SherifHaidar/chief-of-staff-agent-office#21.",
  },
  evidence: {
    collectedAt: "2026-05-17T12:00:00.000Z",
    deployment: {
      deployments: [{ environment: "Preview", state: "success", statuses: [], url: "https://preview.example" }],
      status: "found",
    },
    pullRequest: {
      baseBranch: "main",
      headBranch: "agent-office/impl-closeout",
      headSha: "head-sha",
      mergeSha: "merge-sha",
      merged: true,
      mergedAt: "2026-05-17T11:00:00.000Z",
      mergedBy: "SherifHaidar",
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      state: "closed",
      title: "Add Post-Merge Closeout v0",
      url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21",
    },
  },
  generatedAt: "2026-05-17T12:30:00.000Z",
  input: {
    pullRequestNumber: 21,
    repository: "SherifHaidar/chief-of-staff-agent-office",
    taskId: pageId,
  },
  notionTask: {
    currentStatus: "In Codex",
    pageId,
    title: "Post-Merge Closeout v0",
  },
  plan: {
    blockPreview: "Post-Merge Closeout: SherifHaidar/chief-of-staff-agent-office#21",
    closeoutMarker: "post-merge-closeout:SherifHaidar/chief-of-staff-agent-office#21:merge-sha",
    duplicateMarkerCount: 0,
    markerAlreadyExists: false,
    propertyWrites: [
      {
        name: "Status",
        source: "Status after post-merge closeout",
        status: "written",
        type: "select",
        value: "Merged",
      },
    ],
    taskPrLinkCheck: {
      message: "Selected Notion task PR Link matches SherifHaidar/chief-of-staff-agent-office#21.",
      propertyName: "PR Link",
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      status: "match",
      value: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21",
    },
  },
  propertyWrites: [
    {
      name: "Status",
      source: "Status after post-merge closeout",
      status: "written",
      type: "select",
      value: "Merged",
    },
  ],
};

function createTestApp(
  input: {
    postMergeCloseoutConfigurationMessage?: string;
    postMergeCloseoutWorkflow?: PostMergeCloseoutWorkflowRunner;
    runLog?: InMemoryRunLog;
  } = {},
) {
  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: { writeApprovedBrief: vi.fn() },
    postMergeCloseoutConfigurationMessage: input.postMergeCloseoutConfigurationMessage,
    postMergeCloseoutWorkflow: input.postMergeCloseoutWorkflow,
    readyArchitectureScanner: {
      findReadyForArchitectureTasks: vi.fn().mockResolvedValue([]),
      hasArchitectBrief: vi.fn().mockResolvedValue(false),
    },
    runLog: input.runLog,
    statusAfterWriteback: "Ready for Codex",
    workflow: { run: vi.fn() },
  });
}

describe("Post-Merge Closeout API", () => {
  it("previews closeout without Notion writeback", async () => {
    const runLog = new InMemoryRunLog();
    const preview: PostMergeCloseoutResult = {
      committed: false,
      diagnostics: closeoutResult.diagnostics,
      evidence: closeoutResult.evidence,
      generatedAt: closeoutResult.generatedAt,
      input: closeoutResult.input,
      notionTask: closeoutResult.notionTask,
      plan: closeoutResult.plan,
    };
    const postMergeCloseoutWorkflow = {
      commit: vi.fn<PostMergeCloseoutWorkflowRunner["commit"]>(),
      preview: vi.fn<PostMergeCloseoutWorkflowRunner["preview"]>().mockResolvedValue({
        dryRun: true,
        ok: true,
        pageId,
        result: preview,
        statusUpdated: false,
        title: "Post-Merge Closeout: SherifHaidar/chief-of-staff-agent-office#21",
        wroteToNotion: false,
      }),
    };
    const app = createTestApp({ postMergeCloseoutWorkflow, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 21,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/post-merge-closeout/preview",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(postMergeCloseoutWorkflow.preview).toHaveBeenCalledWith({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });
    expect(body).toMatchObject({
      ok: true,
      preview: {
        committed: false,
      },
      run: {
        dryRun: true,
        notionWriteback: false,
        outcome: "succeeded",
        workflow: "post-merge-closeout",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("commits closeout after explicit request", async () => {
    const postMergeCloseoutWorkflow = {
      commit: vi.fn<PostMergeCloseoutWorkflowRunner["commit"]>().mockResolvedValue({
        dryRun: false,
        ok: true,
        pageId,
        result: closeoutResult,
        statusUpdated: true,
        title: "Post-Merge Closeout: SherifHaidar/chief-of-staff-agent-office#21",
        wroteToNotion: true,
      }),
      preview: vi.fn<PostMergeCloseoutWorkflowRunner["preview"]>(),
    };
    const app = createTestApp({ postMergeCloseoutWorkflow });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 21,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/post-merge-closeout/commit",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(postMergeCloseoutWorkflow.commit).toHaveBeenCalledWith({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });
    expect(body).toMatchObject({
      ok: true,
      result: {
        committed: true,
      },
      run: {
        dryRun: false,
        notionWriteback: true,
        statusUpdated: true,
        workflow: "post-merge-closeout",
      },
    });

    await app.close();
  });

  it("requires owner/name repo and positive PR number", async () => {
    const app = createTestApp({ postMergeCloseoutWorkflow: { commit: vi.fn(), preview: vi.fn() } });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 0,
        repository: "not-a-repo",
        taskId: pageId,
      },
      url: "/agent-office/post-merge-closeout/preview",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Invalid request.");

    await app.close();
  });

  it("returns blocked configuration when Post-Merge Closeout is not wired", async () => {
    const runLog = new InMemoryRunLog();
    const app = createTestApp({
      postMergeCloseoutConfigurationMessage:
        "Post-Merge Closeout is blocked until this configuration is set: GITHUB_APP_ID.",
      runLog,
    });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 21,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/post-merge-closeout/preview",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Post-Merge Closeout is blocked until this configuration is set: GITHUB_APP_ID.",
      ok: false,
      status: "blocked",
      taskId: pageId,
    });
    expect(runLog.records).toHaveLength(0);

    await app.close();
  });
});
