import { describe, expect, it, vi } from "vitest";

import type { ArchitectBrief } from "../../src/domain/architect-brief.js";
import { createAgentOfficeApp, type ArchitectReviewWorkflow } from "../../src/server/app.js";
import type { WorkflowResult } from "../../src/workflows/workflow-result.js";

const pageId = "11111111-1111-1111-1111-111111111111";

const brief: ArchitectBrief = {
  briefTitle: "Orchestrator API v0",
  configuration: [],
  dependencies: [],
  executiveSummary: "Expose the existing Architect workflow through a minimal HTTP API.",
  fileStructure: ["src/server/app.ts"],
  implementationPlan: ["Validate request", "Run workflow", "Return JSON result"],
  openQuestions: [],
  recommendedArchitecture: ["Keep the API layer thin and delegate to the workflow."],
  risks: [],
};

function createWorkflow(result: WorkflowResult) {
  return {
    run: vi.fn<ArchitectReviewWorkflow["run"]>().mockResolvedValue(result),
  };
}

describe("Agent Office API", () => {
  it("returns service health", async () => {
    const app = createAgentOfficeApp({
      statusAfterWriteback: "Ready for Codex",
      workflow: createWorkflow({
        brief,
        dryRun: true,
        ok: true,
        pageId,
        statusUpdated: false,
        title: "Test task",
        wroteToNotion: false,
      }),
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "chief-of-staff-agent-office",
      status: "healthy",
    });

    await app.close();
  });

  it("rejects architect review requests without a taskId", async () => {
    const workflow = createWorkflow({
      error: { message: "should not run" },
      ok: false,
    });
    const app = createAgentOfficeApp({ statusAfterWriteback: "Ready for Codex", workflow });

    const response = await app.inject({
      method: "POST",
      payload: { dryRun: true },
      url: "/agent-office/architect-review",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ ok: false });
    expect(response.json().error).toContain("taskId");
    expect(workflow.run).not.toHaveBeenCalled();

    await app.close();
  });

  it("runs the Architect workflow in dry-run mode without reporting writes", async () => {
    const workflow = createWorkflow({
      brief,
      dryRun: true,
      ok: true,
      pageId,
      statusUpdated: false,
      title: "Test task",
      wroteToNotion: false,
    });
    const app = createAgentOfficeApp({ statusAfterWriteback: "Ready for Codex", workflow });

    const response = await app.inject({
      method: "POST",
      payload: { dryRun: true, taskId: pageId },
      url: "/agent-office/architect-review",
    });

    expect(response.statusCode).toBe(200);
    expect(workflow.run).toHaveBeenCalledWith({
      dryRun: true,
      pageId,
      statusAfterWriteback: "Ready for Codex",
    });
    expect(response.json()).toEqual({
      briefGenerated: true,
      dryRun: true,
      ok: true,
      statusUpdated: false,
      taskId: pageId,
    });

    await app.close();
  });

  it("returns a clear workflow error response", async () => {
    const workflow = createWorkflow({
      error: { message: "Notion page not found" },
      ok: false,
      pageId,
    });
    const app = createAgentOfficeApp({ statusAfterWriteback: "Ready for Codex", workflow });

    const response = await app.inject({
      method: "POST",
      payload: { dryRun: false, taskId: pageId },
      url: "/agent-office/architect-review",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Notion page not found",
      ok: false,
      taskId: pageId,
    });

    await app.close();
  });
});
