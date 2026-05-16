import { describe, expect, it } from "vitest";

import type { ArchitectBrief } from "../src/domain/architect-brief.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../src/domain/implementation-proposal.js";
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
  it("renders implementation PR evidence and verification details", () => {
    const proposal: ImplementationProposal = {
      approvalWarnings: ["Draft only."],
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-test",
      changedFiles: [{ action: "update", content: "export const ok = true;\n", path: "lib/capture.ts", summary: "Update capture." }],
      commitMessage: "Update capture",
      contextGaps: ["One additional file should be inspected manually."],
      draft: true,
      implementationSummary: "Update the capture helper.",
      prBody: "## Summary\n- Update capture",
      prTitle: "[Draft] Update capture",
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: "22222222-2222-2222-2222-222222222222",
      taskName: "Update capture",
      verificationPlan: {
        acceptanceCriteria: ["Capture works."],
        automatedChecks: ["npm test"],
        evidenceToCollect: ["GitHub checks"],
        manualChecks: ["Submit a test capture."],
        regressionRisks: ["Capture regression."],
      },
    };
    const result: ImplementationExecutionResult = {
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-test",
      changedFiles: [{ action: "update", path: "lib/capture.ts", summary: "Update capture." }],
      checks: [{ conclusion: "success", name: "CI", status: "completed" }],
      commitSha: "commit-sha",
      draft: true,
      evidence: {
        automatedChecksSummary: "GitHub checks reported no failing conclusions at capture time.",
        evidence: ["CI: success"],
        verificationGaps: [],
      },
      pullRequestNumber: 55,
      pullRequestUrl: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/55",
      repository: "SherifHaidar/personal-chief-of-staff",
    };

    const blocks = renderImplementationResultBlocks(result, proposal, new Date("2026-05-14T12:00:00.000Z"));
    const serialized = JSON.stringify(blocks);

    expect(serialized).toContain("Controlled Implementation Draft PR");
    expect(serialized).toContain("Verification Gaps");
    expect(serialized).toContain("CI: success");
    expect(serialized).toContain("Draft only");
  });
});
