import { describe, expect, it, vi } from "vitest";

import type { AiBuildTask } from "../src/domain/ai-build-task.js";
import type { CodexHandoffBrief } from "../src/domain/codex-handoff-brief.js";
import type { ProductContextPack } from "../src/domain/product-context-pack.js";
import { silentLogger } from "../src/utils/logger.js";
import { CodexHandoffWorkflow, type CodexHandoffTaskRepository } from "../src/workflows/codex-handoff.workflow.js";

const pageId = "22222222-2222-2222-2222-222222222222";
const targetProductRepo = "SherifHaidar/personal-chief-of-staff";

const task: AiBuildTask = {
  contentMarkdown: "Build Tasks DB integration.",
  pageId,
  properties: {},
  status: "Ready for Codex",
  title: "Tasks DB integration",
};

const handoff: CodexHandoffBrief = {
  acceptanceChecklist: ["Quick Task creates a task row."],
  constraints: ["Do not break current project saves."],
  explicitApprovalWarnings: ["Merge requires Sherif approval.", "Deployment requires Sherif approval."],
  implementationScope: ["Implement Tasks DB write path."],
  implementationSteps: ["Inspect Notion sync", "Implement", "Test"],
  likelyAffectedFiles: ["lib/notion.ts"],
  problemSummary: "Quick Task needs durable task rows.",
  productIntent: "Replace fragile Weekly To-do block insertion.",
  suggestedBranchName: "codex/tasks-db-v0",
  suggestedPrBody: "## Summary\n- Add Tasks DB path",
  suggestedPrTitle: "Add Tasks DB path",
  targetProductRepo,
  testsToRun: ["npm run build"],
};

const productContext: ProductContextPack = {
  budgets: {
    maxFileChars: 8000,
    maxFiles: 10,
    maxNotionChars: 16000,
    maxTotalChars: 32000,
  },
  contextGaps: ["app/page.tsx was truncated."],
  generatedAt: "2026-05-14T12:00:00.000Z",
  included: true,
  notionContext: {
    chars: 32,
    contentMarkdown: "Quick Task should move to Tasks DB.",
    pageId: "361b258f-9a3e-819f-8cd9-f9e33d768e0a",
    title: "Agent Context",
    truncated: false,
  },
  sources: [],
  targetProductRepo,
};

function createWorkflow() {
  const repository: CodexHandoffTaskRepository = {
    appendCodexHandoffBrief: vi.fn().mockResolvedValue(undefined),
    fetchTask: vi.fn().mockResolvedValue(task),
    markCodexHandoffReady: vi.fn().mockResolvedValue(undefined),
  };
  const codexHandoff = {
    createHandoff: vi.fn().mockResolvedValue(handoff),
  };
  const productContextProvider = {
    build: vi.fn().mockResolvedValue(productContext),
  };
  const workflow = new CodexHandoffWorkflow({
    codexHandoff,
    logger: silentLogger,
    now: () => new Date("2026-05-14T12:00:00.000Z"),
    productContextProvider,
    taskRepository: repository,
  });

  return { codexHandoff, productContextProvider, repository, workflow };
}

describe("CodexHandoffWorkflow", () => {
  it("passes the Product Context Pack into the Codex Handoff agent during preview", async () => {
    const { codexHandoff, productContextProvider, repository, workflow } = createWorkflow();

    const result = await workflow.run({
      dryRun: true,
      pageId,
      statusAfterWriteback: "In Codex",
      targetProductRepo,
    });

    expect(result.ok).toBe(true);
    expect(productContextProvider.build).toHaveBeenCalledWith({ targetProductRepo, task });
    expect(codexHandoff.createHandoff).toHaveBeenCalledWith(task, { productContext, targetProductRepo });
    expect(result.ok ? result.productContext?.included : false).toBe(true);
    expect(repository.appendCodexHandoffBrief).not.toHaveBeenCalled();
  });
});
