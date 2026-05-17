import { describe, expect, it, vi } from "vitest";

import type { ClaudeReviewRunner } from "../../src/agents/claude-review.agent.js";
import type { AiBuildTask } from "../../src/domain/ai-build-task.js";
import type { ClaudeReviewPacket, ReviewDeskPullRequestEvidence } from "../../src/domain/review-desk.js";
import type { ReviewDeskService } from "../../src/github/review-desk.service.js";
import { ReviewDeskWorkflow, type ReviewDeskTaskRepository } from "../../src/workflows/review-desk.workflow.js";

const pageId = "22222222-2222-2222-2222-222222222222";

const task: AiBuildTask = {
  contentMarkdown: "### Acceptance Checklist\n- Review packet is generated.\n- Final approval is not implied.",
  pageId,
  properties: {},
  status: "In Codex",
  title: "Review Desk task",
  url: "https://notion.example/task",
};

const pullRequest: ReviewDeskPullRequestEvidence = {
  author: "codex",
  baseBranch: "main",
  body: "Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
  changedFiles: [{ additions: 5, deletions: 1, path: "src/review.ts", patch: "@@ patch", patchTruncated: false, status: "modified" }],
  checks: [{ conclusion: "success", name: "CI", status: "completed" }],
  collectionWarnings: [],
  deployments: [{ environment: "Preview", state: "success", statuses: [], url: "https://preview.example" }],
  draft: true,
  headBranch: "agent-office/impl-review",
  headSha: "head-sha",
  pullRequestNumber: 20,
  repository: "SherifHaidar/chief-of-staff-agent-office",
  state: "open",
  title: "Add Review Desk",
  url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/20",
};

const claudeReview: ClaudeReviewPacket = {
  acceptanceChecklist: [{ criterion: "Review packet is generated.", notes: "Covered by the route.", status: "pass" }],
  missingEvidence: [],
  risks: ["Manual smoke testing still required."],
  suggestedSmokeTests: ["Run the review route against PR #20."],
  summary: "The implementation is ready for human smoke testing.",
  verdict: "Ready for Human Smoke Test",
};

const needsFixReview: ClaudeReviewPacket = {
  acceptanceChecklist: [{ criterion: "Final approval is not implied.", notes: "The UI still uses approval copy.", status: "fail" }],
  codexFixBrief: {
    instructions: ["Replace approval copy with human smoke-test copy."],
    summary: "Tighten Review Desk approval-boundary copy.",
    verification: ["Run the Review Desk renderer tests."],
  },
  missingEvidence: [],
  risks: ["Users may confuse Review Desk output for merge approval."],
  suggestedSmokeTests: ["Run the review route against a draft PR."],
  summary: "Codex needs to fix the approval-boundary language before smoke testing.",
  verdict: "Needs Codex Fixes",
};

function createRepository() {
  return {
    appendReviewDeskResult: vi.fn<ReviewDeskTaskRepository["appendReviewDeskResult"]>().mockResolvedValue(undefined),
    fetchTask: vi.fn<ReviewDeskTaskRepository["fetchTask"]>().mockResolvedValue(task),
  };
}

function createService(overrides: Partial<ReviewDeskPullRequestEvidence> = {}) {
  return {
    collectPullRequestEvidence: vi.fn().mockResolvedValue({ ...pullRequest, ...overrides }),
    fetchWorkOrderFromPullRequest: vi.fn().mockResolvedValue({
      markdown: "### Acceptance Checklist\n- Review packet is generated.",
      path: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
    }),
  } as unknown as ReviewDeskService;
}

function createReviewer(review = claudeReview) {
  return {
    review: vi.fn<ClaudeReviewRunner["review"]>().mockResolvedValue(review),
  };
}

describe("ReviewDeskWorkflow", () => {
  it("collects evidence, runs Claude review, applies gates, and writes to Notion", async () => {
    const repository = createRepository();
    const reviewer = createReviewer();
    const service = createService();
    const workflow = new ReviewDeskWorkflow({
      now: () => new Date("2026-05-17T10:00:00.000Z"),
      reviewDeskService: service,
      reviewer,
      taskRepository: repository,
    });

    const result = await workflow.run({
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      pageId,
      result: {
        review: {
          summary: "The implementation is ready for human smoke testing.",
          verdict: "Ready for Human Smoke Test",
        },
      },
      wroteToNotion: true,
    });
    expect(reviewer.review).toHaveBeenCalledOnce();
    expect(repository.appendReviewDeskResult).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        finalApprovalWarning: expect.stringContaining("not merge approval"),
      }),
      new Date("2026-05-17T10:00:00.000Z"),
    );
  });

  it("blocks before Claude when changed-file evidence is missing", async () => {
    const repository = createRepository();
    const reviewer = createReviewer();
    const workflow = new ReviewDeskWorkflow({
      now: () => new Date("2026-05-17T10:00:00.000Z"),
      reviewDeskService: createService({ changedFiles: [] }),
      reviewer,
      taskRepository: repository,
    });

    const result = await workflow.run({
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        review: {
          verdict: "Blocked",
        },
      },
    });
    expect(reviewer.review).not.toHaveBeenCalled();
    expect(repository.appendReviewDeskResult).toHaveBeenCalledOnce();
  });

  it("downgrades Claude ready verdict when checks fail", async () => {
    const workflow = new ReviewDeskWorkflow({
      now: () => new Date("2026-05-17T10:00:00.000Z"),
      reviewDeskService: createService({ checks: [{ conclusion: "failure", name: "CI", status: "completed" }] }),
      reviewer: createReviewer(),
      taskRepository: createRepository(),
    });

    const result = await workflow.run({
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        review: {
          verdict: "Needs Codex Fixes",
        },
      },
    });
  });

  it("preserves Needs Codex Fixes review packets with a Codex fix brief", async () => {
    const repository = createRepository();
    const workflow = new ReviewDeskWorkflow({
      now: () => new Date("2026-05-17T10:00:00.000Z"),
      reviewDeskService: createService(),
      reviewer: createReviewer(needsFixReview),
      taskRepository: repository,
    });

    const result = await workflow.run({
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        review: {
          codexFixBrief: {
            summary: "Tighten Review Desk approval-boundary copy.",
          },
          verdict: "Needs Codex Fixes",
        },
      },
    });
    expect(repository.appendReviewDeskResult).toHaveBeenCalledWith(
      pageId,
      expect.objectContaining({
        review: expect.objectContaining({
          codexFixBrief: expect.objectContaining({
            instructions: ["Replace approval copy with human smoke-test copy."],
          }),
        }),
      }),
      new Date("2026-05-17T10:00:00.000Z"),
    );
  });

  it("blocks when Claude structured output is invalid", async () => {
    const repository = createRepository();
    const workflow = new ReviewDeskWorkflow({
      now: () => new Date("2026-05-17T10:00:00.000Z"),
      reviewDeskService: createService(),
      reviewer: {
        review: vi.fn<ClaudeReviewRunner["review"]>().mockRejectedValue(
          new Error("Claude structured review validation failed: verdict: invalid value"),
        ),
      },
      taskRepository: repository,
    });

    const result = await workflow.run({
      pullRequestNumber: 20,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        review: {
          missingEvidence: [
            "Claude structured review failed: Claude structured review validation failed: verdict: invalid value",
          ],
          verdict: "Blocked",
        },
      },
    });
    expect(repository.appendReviewDeskResult).toHaveBeenCalledOnce();
  });
});
