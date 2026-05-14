import { describe, expect, it, vi } from "vitest";

import type { AiBuildTask } from "../src/domain/ai-build-task.js";
import type { ArchitectBrief } from "../src/domain/architect-brief.js";
import { silentLogger } from "../src/utils/logger.js";
import { ArchitectTaskWorkflow, type ArchitectTaskRepository } from "../src/workflows/architect-task.workflow.js";

const pageId = "11111111-1111-1111-1111-111111111111";

const task: AiBuildTask = {
  contentMarkdown: "Build the v0 orchestrator.",
  pageId,
  properties: {},
  status: "Ready for Architect",
  title: "AI Build Task",
};

const brief: ArchitectBrief = {
  briefTitle: "Orchestrator v0",
  configuration: [],
  dependencies: [],
  executiveSummary: "Create the safe Notion to Architect workflow.",
  fileStructure: ["src/workflows/architect-task.workflow.ts"],
  implementationPlan: ["Fetch", "Run", "Write"],
  openQuestions: [],
  recommendedArchitecture: ["Keep writes outside the agent."],
  risks: [],
};

function createWorkflow(dryRun = false) {
  const repository: ArchitectTaskRepository = {
    appendArchitectBrief: vi.fn().mockResolvedValue(undefined),
    fetchTask: vi.fn().mockResolvedValue(task),
    markArchitectBriefReady: vi.fn().mockResolvedValue(undefined),
  };
  const architect = {
    createBrief: vi.fn().mockResolvedValue(brief),
  };
  const workflow = new ArchitectTaskWorkflow({
    architect,
    logger: silentLogger,
    now: () => new Date("2026-05-14T12:00:00.000Z"),
    taskRepository: repository,
  });

  return { architect, dryRun, repository, workflow };
}

describe("ArchitectTaskWorkflow", () => {
  it("does not write to Notion during a dry run", async () => {
    const { repository, workflow } = createWorkflow(true);
    const result = await workflow.run({ dryRun: true, pageId, statusAfterWriteback: "Architect Brief Ready" });

    expect(result.ok).toBe(true);
    expect(repository.appendArchitectBrief).not.toHaveBeenCalled();
    expect(repository.markArchitectBriefReady).not.toHaveBeenCalled();
  });

  it("appends the brief before updating status", async () => {
    const { repository, workflow } = createWorkflow();
    const result = await workflow.run({ pageId, statusAfterWriteback: "Architect Brief Ready" });

    expect(result.ok).toBe(true);
    expect(repository.appendArchitectBrief).toHaveBeenCalledWith(pageId, brief, new Date("2026-05-14T12:00:00.000Z"));
    expect(repository.markArchitectBriefReady).toHaveBeenCalledWith(pageId, "Architect Brief Ready");
  });
});
