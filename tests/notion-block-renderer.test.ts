import { describe, expect, it } from "vitest";

import type { ArchitectBrief } from "../src/domain/architect-brief.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../src/domain/implementation-proposal.js";
import { IMPLEMENTATION_PENDING_NOTICE } from "../src/domain/implementation-proposal.js";
import { chunkBlocks, renderArchitectBriefBlocks, renderImplementationResultBlocks } from "../src/notion/notion-block-renderer.js";

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
