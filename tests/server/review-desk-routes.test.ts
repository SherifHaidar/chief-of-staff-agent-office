import { describe, expect, it, vi } from "vitest";

import { InMemoryRunLog } from "../../src/audit/run-log.js";
import type { ReviewDeskResult } from "../../src/domain/review-desk.js";
import { createAgentOfficeApp, type ReviewDeskWorkflowRunner } from "../../src/server/app.js";

const apiKey = "test-agent-office-key";
const approvalSecret = "test-approval-secret";
const authHeaders = { "x-agent-office-api-key": apiKey };
const pageId = "22222222-2222-2222-2222-222222222222";

const reviewDeskResult: ReviewDeskResult = {
  evidence: {
    collectedAt: "2026-05-17T10:00:00.000Z",
    input: {
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    },
    missingEvidence: [],
    policyFindings: [],
    pullRequest: {
      baseBranch: "main",
      body: "Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
      changedFiles: [{ additions: 1, deletions: 0, path: "src/review.ts", patchTruncated: false, status: "modified" }],
      checks: [{ conclusion: "success", name: "CI", status: "completed" }],
      collectionWarnings: [],
      deployments: [],
      draft: true,
      headBranch: "agent-office/impl-review",
      headSha: "head-sha",
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      state: "open",
      title: "Add Review Desk",
      url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/20",
    },
    workOrder: {
      acceptanceCriteria: ["Review packet generated."],
      contentMarkdown: "Task markdown.",
      pageTitle: "Review task",
      taskId: pageId,
    },
  },
  finalApprovalWarning: "Review Desk output is not merge approval.",
  review: {
    acceptanceChecklist: [{ criterion: "Review packet generated.", notes: "Covered.", status: "pass" }],
    missingEvidence: [],
    risks: [],
    suggestedSmokeTests: ["Open the preview."],
    summary: "Ready for smoke testing.",
    verdict: "Ready for Human Smoke Test",
  },
};

function createTestApp(input: { reviewDeskWorkflow?: ReviewDeskWorkflowRunner; runLog?: InMemoryRunLog } = {}) {
  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: { writeApprovedBrief: vi.fn() },
    readyArchitectureScanner: {
      findReadyForArchitectureTasks: vi.fn().mockResolvedValue([]),
      hasArchitectBrief: vi.fn().mockResolvedValue(false),
    },
    reviewDeskWorkflow: input.reviewDeskWorkflow,
    runLog: input.runLog,
    statusAfterWriteback: "Ready for Codex",
    workflow: { run: vi.fn() },
  });
}

describe("Review Desk API", () => {
  it("runs the review desk and records the run", async () => {
    const runLog = new InMemoryRunLog();
    const reviewDeskWorkflow = {
      run: vi.fn<ReviewDeskWorkflowRunner["run"]>().mockResolvedValue({
        dryRun: false,
        ok: true,
        pageId,
        result: reviewDeskResult,
        statusUpdated: false,
        title: "Review Desk: SherifHaidar/chief-of-staff-agent-office#20",
        wroteToNotion: true,
      }),
    };
    const app = createTestApp({ reviewDeskWorkflow, runLog });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 20,
        repository: "SherifHaidar/chief-of-staff-agent-office",
        taskId: pageId,
      },
      url: "/agent-office/review-desk",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(reviewDeskWorkflow.run).toHaveBeenCalledWith({
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });
    expect(body).toMatchObject({
      ok: true,
      result: {
        review: {
          verdict: "Ready for Human Smoke Test",
        },
      },
      run: {
        briefGenerated: true,
        dryRun: false,
        notionWriteback: true,
        outcome: "succeeded",
        statusUpdated: false,
        taskId: pageId,
        workflow: "review-desk",
      },
      taskId: pageId,
    });
    expect(runLog.records).toEqual([body.run]);

    await app.close();
  });

  it("requires owner/name repo and positive PR number", async () => {
    const app = createTestApp({ reviewDeskWorkflow: { run: vi.fn() } });

    const response = await app.inject({
      headers: authHeaders,
      method: "POST",
      payload: {
        pullRequestNumber: 0,
        repository: "not-a-repo",
        taskId: pageId,
      },
      url: "/agent-office/review-desk",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Invalid request.");

    await app.close();
  });
});

