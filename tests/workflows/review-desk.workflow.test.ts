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
});

