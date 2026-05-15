import { describe, expect, it } from "vitest";

import type { ArchitectBrief } from "../src/domain/architect-brief.js";
import { chunkBlocks, renderArchitectBriefBlocks } from "../src/notion/notion-block-renderer.js";

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
