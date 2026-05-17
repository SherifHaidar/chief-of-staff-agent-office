import { describe, expect, it } from "vitest";

import type { ArchitectBrief } from "../src/domain/architect-brief.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../src/domain/implementation-proposal.js";
import { IMPLEMENTATION_PENDING_NOTICE } from "../src/domain/implementation-proposal.js";
import type { PostMergeCloseoutResult } from "../src/domain/post-merge-closeout.js";
import type { ReviewDeskResult } from "../src/domain/review-desk.js";
import {
  chunkBlocks,
  renderArchitectBriefBlocks,
  renderImplementationResultBlocks,
  renderPostMergeCloseoutBlocks,
  renderReviewDeskResultBlocks,
} from "../src/notion/notion-block-renderer.js";

const brief: ArchitectBrief = {
  briefTitle: "Orchestrator v0",
  configuration: ["NOTION_TOKEN", "OPENAI_API_KEY"],
  dependencies: ["@openai/agents", "@notionhq/client"],
  executiveSummary: "Build the smallest safe workflow from Notion task to Architect Brief writeback.",
  fileStructure: ["src/workflows/architect-task.workflow.ts", "src/agents/architect.agent.ts"],
  implementationPlan: ["Fetch task", "Run agent", "Append brief", "Update status"],
  openQuestions: [],
  recommendedArchitecture: ["Keep side effects in the workflow, not the agent."],
  risks: ["Duplicate writebacks need idempotency in a later version."],
};

describe("renderArchitectBriefBlocks", () => {
  it("renders deterministic Notion blocks for an architect brief", () => {
    const blocks = renderArchitectBriefBlocks(brief, new Date("2026-05-14T12:00:00.000Z"));

    expect(blocks[0]).toMatchObject({ type: "divider" });
    expect(blocks[1]).toMatchObject({ type: "heading_2" });
    expect(blocks.some((block) => block.type === "bulleted_list_item")).toBe(true);
  });

  it("renders approved revision metadata and owner decision notes", () => {
    const blocks = renderArchitectBriefBlocks(
      {
        ...brief,
        openQuestions: ["Should Sherif approve the product scope first?"],
      },
      new Date("2026-05-14T12:00:00.000Z"),
      {
        approvalTimestamp: "2026-05-14T12:05:00.000Z",
        contextGaps: ["Product repo file cap reached."],
        decisionStatus: "Needs Owner Decisions",
        revisionFeedbackHash: "feedback-hash",
        revisionNumber: 3,
        revisionOfPreviewRunId: "run_v2",
      },
    );
    const serialized = JSON.stringify(blocks);

    expect(serialized).toContain("Latest approved Architect Brief.");
    expect(serialized).toContain("Revision: v3.");
    expect(serialized).toContain("Needs Owner Decisions");
    expect(serialized).toContain("Owner Decision Notes");
    expect(serialized).toContain("Product repo file cap reached.");
  });

  it("chunks block arrays for Notion append limits", () => {
    const chunks = chunkBlocks(new Array(205).fill({ type: "paragraph", paragraph: { rich_text: [] } }), 100);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(5);
  });
});

describe("renderImplementationResultBlocks", () => {
  it("renders implementation work-order PR details without implying implementation is complete", () => {
    const proposal: ImplementationProposal = {
      approvalWarnings: ["Draft only."],
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-test",
      commitMessage: "Add implementation work order",
      draft: true,
      handoffSummary: {
        acceptanceChecklist: ["Capture works."],
        constraints: ["Do not merge or deploy."],
        implementationScope: ["Prepare implementation work."],
        implementationSteps: ["Inspect code", "Implement", "Test"],
        likelyAffectedFiles: ["lib/capture.ts"],
        problemSummary: "Capture needs improvement.",
        productIntent: "Make capture smoother.",
        suggestedBranchName: "codex/update-capture",
        suggestedPrTitle: "Update capture",
        testsToRun: ["npm test"],
      },
      nextAction: "Codex must implement on this branch, run relevant tests, and return evidence before human merge or deploy approval.",
      prBody: `${IMPLEMENTATION_PENDING_NOTICE}\n\nWork order only.`,
      prTitle: "[Draft] Implementation pending: Update capture",
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: "22222222-2222-2222-2222-222222222222",
      taskName: "Update capture",
      workOrderContent: `${IMPLEMENTATION_PENDING_NOTICE}\n\n# Work order`,
      workOrderPath: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
    };
    const result: ImplementationExecutionResult = {
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-test",
      checks: [{ conclusion: "success", name: "CI", status: "completed" }],
      commitSha: "commit-sha",
      draft: true,
      nextAction: proposal.nextAction,
      pullRequestNumber: 55,
      pullRequestUrl: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/55",
      repository: "SherifHaidar/personal-chief-of-staff",
      workOrderPath: proposal.workOrderPath,
    };

    const blocks = renderImplementationResultBlocks(result, proposal, new Date("2026-05-14T12:00:00.000Z"));
    const serialized = JSON.stringify(blocks);

    expect(serialized).toContain("Implementation Work-Order Draft PR");
    expect(serialized).toContain(IMPLEMENTATION_PENDING_NOTICE);
    expect(serialized).toContain("Work Order File");
    expect(serialized).toContain("CI: success");
    expect(serialized).toContain("Product code has not been implemented by this step.");
  });
});

describe("renderReviewDeskResultBlocks", () => {
  it("renders review packets without implying final approval", () => {
    const result: ReviewDeskResult = {
      evidence: {
        collectedAt: "2026-05-17T10:00:00.000Z",
        input: {
          pullRequestNumber: 20,
          repository: "SherifHaidar/chief-of-staff-agent-office",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
        missingEvidence: [],
        policyFindings: [{ message: "No GitHub-exposed Vercel/deployment evidence was found.", severity: "missing_evidence" }],
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
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      },
      finalApprovalWarning: "Review Desk output is not merge approval, deployment approval, or final Sherif approval.",
      review: {
        acceptanceChecklist: [{ criterion: "Review packet generated.", notes: "Covered.", status: "pass" }],
        missingEvidence: ["No GitHub-exposed Vercel/deployment evidence was found."],
        risks: ["Manual smoke testing still required."],
        suggestedSmokeTests: ["Open the preview."],
        summary: "Ready for human smoke testing.",
        verdict: "Ready for Human Smoke Test",
      },
    };

    const blocks = renderReviewDeskResultBlocks(result, new Date("2026-05-17T10:00:00.000Z"));
    const serialized = JSON.stringify(blocks);

    expect(serialized).toContain("Review + Iteration Desk");
    expect(serialized).toContain("Ready for Human Smoke Test");
    expect(serialized).toContain("not merge approval");
    expect(serialized).toContain("does not merge, deploy, approve production, or dispatch Codex fixes automatically");
  });

  it("does not render a Draft Codex Fix Brief for Ready review packets", () => {
    const result: ReviewDeskResult = {
      evidence: {
        collectedAt: "2026-05-17T10:00:00.000Z",
        input: {
          pullRequestNumber: 20,
          repository: "SherifHaidar/chief-of-staff-agent-office",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
        missingEvidence: [],
        policyFindings: [],
        pullRequest: {
          baseBranch: "main",
          body: "Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
          changedFiles: [{ additions: 1, deletions: 0, path: "src/review.ts", patchTruncated: false, status: "modified" }],
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
        },
        workOrder: {
          acceptanceCriteria: ["Review packet generated."],
          contentMarkdown: "Task markdown.",
          pageTitle: "Review task",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      },
      finalApprovalWarning: "Review Desk output is not merge approval, deployment approval, or final Sherif approval.",
      review: {
        acceptanceChecklist: [{ criterion: "Review packet generated.", notes: "Covered.", status: "pass" }],
        codexFixBrief: {
          instructions: ["This stale brief must not render."],
          summary: "Stale fix brief.",
          verification: ["Run tests."],
        },
        missingEvidence: [],
        risks: [],
        suggestedSmokeTests: ["Open the preview."],
        summary: "Ready for human smoke testing.",
        verdict: "Ready for Human Smoke Test",
      },
    };
    const serialized = JSON.stringify(renderReviewDeskResultBlocks(result, new Date("2026-05-17T10:00:00.000Z")));

    expect(serialized).not.toContain("Draft Codex Fix Brief");
    expect(serialized).not.toContain("This stale brief must not render.");
  });

  it("renders a Draft Codex Fix Brief for Needs Codex Fixes review packets", () => {
    const result: ReviewDeskResult = {
      evidence: {
        collectedAt: "2026-05-17T10:00:00.000Z",
        input: {
          pullRequestNumber: 20,
          repository: "SherifHaidar/chief-of-staff-agent-office",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
        missingEvidence: [],
        policyFindings: [],
        pullRequest: {
          baseBranch: "main",
          body: "Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
          changedFiles: [{ additions: 1, deletions: 0, path: "src/review.ts", patchTruncated: false, status: "modified" }],
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
        },
        workOrder: {
          acceptanceCriteria: ["Review packet generated."],
          contentMarkdown: "Task markdown.",
          pageTitle: "Review task",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      },
      finalApprovalWarning: "Review Desk output is not merge approval, deployment approval, or final Sherif approval.",
      review: {
        acceptanceChecklist: [{ criterion: "Review packet generated.", notes: "Needs copy fixes.", status: "fail" }],
        codexFixBrief: {
          instructions: ["Replace approval copy."],
          summary: "Fix approval-boundary wording.",
          verification: ["Run renderer tests."],
        },
        missingEvidence: [],
        risks: ["Approval boundary is unclear."],
        suggestedSmokeTests: ["Open the preview."],
        summary: "Codex fixes are needed.",
        verdict: "Needs Codex Fixes",
      },
    };
    const serialized = JSON.stringify(renderReviewDeskResultBlocks(result, new Date("2026-05-17T10:00:00.000Z")));

    expect(serialized).toContain("Draft Codex Fix Brief");
    expect(serialized).toContain("Fix approval-boundary wording.");
    expect(serialized).toContain("Replace approval copy.");
    expect(serialized).toContain("Run renderer tests.");
  });
});

describe("renderPostMergeCloseoutBlocks", () => {
  it("renders the closeout marker and approval boundary", () => {
    const result: PostMergeCloseoutResult = {
      blockAppended: true,
      committed: true,
      diagnostics: {
        deploymentLookup: "missing: No GitHub deployment records were found for the merge commit.",
        githubVerification: "merged PR verified at 2026-05-17T11:00:00.000Z with merge SHA merge-sha",
        idempotency: "marker not present; closeout block can be appended",
        notionTaskTarget: "Post-Merge Closeout v0 (22222222-2222-2222-2222-222222222222)",
        properties: ["Status: planned select update"],
      },
      evidence: {
        collectedAt: "2026-05-17T12:00:00.000Z",
        deployment: {
          deployments: [],
          message: "No GitHub deployment records were found for the merge commit.",
          status: "missing",
        },
        pullRequest: {
          baseBranch: "main",
          headBranch: "agent-office/impl-closeout",
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
        taskId: "22222222-2222-2222-2222-222222222222",
      },
      notionTask: {
        currentStatus: "In Codex",
        pageId: "22222222-2222-2222-2222-222222222222",
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

    const serialized = JSON.stringify(renderPostMergeCloseoutBlocks(result, new Date("2026-05-17T12:30:00.000Z")));

    expect(serialized).toContain("Post-Merge Closeout");
    expect(serialized).toContain("post-merge-closeout:SherifHaidar/chief-of-staff-agent-office#21:merge-sha");
    expect(serialized).toContain("does not merge, deploy, approve production, or dispatch Codex fixes automatically");
  });
});
