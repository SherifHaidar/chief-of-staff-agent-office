import { describe, expect, it, vi } from "vitest";

import type { AiBuildTask } from "../../src/domain/ai-build-task.js";
import type { CodexDispatchEvidence } from "../../src/domain/codex-dispatch.js";
import {
  DisabledDirectCodexDispatcher,
  createCodexDispatchPlan,
  parseCodexDispatchWorkOrder,
} from "../../src/domain/codex-dispatch.js";
import type { CodexDispatchService } from "../../src/github/codex-dispatch.service.js";
import {
  CodexDispatchWorkflow,
  type CodexDispatchTaskRepository,
} from "../../src/workflows/codex-dispatch.workflow.js";

const pageId = "364b258f-9a3e-8153-a329-c184b7f6a630";
const repository = "SherifHaidar/chief-of-staff-agent-office";
const branchName = "agent-office/impl-add-post-merge-closeout-v0-363b258f";
const workOrderPath = ".agent-office/work-orders/363b258f-9a3e-8153-a329-c184b7f6a630.md";

const workOrderMarkdown = [
  "# Agent Office Implementation Work Order",
  "",
  "## Task",
  `- Task ID: ${pageId}`,
  "- Task name: Add Post-Merge Closeout v0",
  "- Notion status at preview: In Codex",
  "- Notion URL: https://www.notion.so/Add-Post-Merge-Closeout-v0-364b258f9a3e8153a329c184b7f6a630",
  "",
  "## Branch and PR Starting Point",
  `- Repository: ${repository}`,
  "- Base branch: main",
  "- Base commit: d5b7d0226e7b970086a7a9059c785affa719e687",
  `- Branch: ${branchName}`,
  "- Draft PR title: [Draft] Implementation pending: Add Post-Merge Closeout v0",
  `- Work order path: ${workOrderPath}`,
  "",
  "## Approved Codex Handoff Summary",
  "",
  "### Problem Summary",
  "Add Post-Merge Closeout v0.",
  "",
  "### Product Intent",
  "Record evidence after merge without adding merge or deploy behavior.",
  "",
  "### Implementation Scope",
  "- Preview closeout",
  "- Commit closeout",
  "",
  "### Constraints / Do Not Change",
  "- Do not merge.",
  "- Do not deploy production.",
  "",
  "### Implementation Steps",
  "- Implement closeout domain and workflow.",
  "",
  "### Tests to Run",
  "- npm test",
  "- npm run typecheck",
  "",
  "### Acceptance Checklist",
  "- Packet contains metadata Sherif previously copied manually.",
].join("\n");

const task: AiBuildTask = {
  contentMarkdown: "Task body",
  pageId,
  properties: {},
  status: "In Codex",
  title: "Add Post-Merge Closeout v0",
  url: "https://www.notion.so/Add-Post-Merge-Closeout-v0-364b258f9a3e8153a329c184b7f6a630",
};

const evidence: CodexDispatchEvidence = {
  collectedAt: "2026-05-18T09:00:00.000Z",
  pullRequest: {
    baseBranch: "main",
    baseCommitSha: "d5b7d0226e7b970086a7a9059c785affa719e687",
    draft: true,
    headBranch: branchName,
    headSha: "head-sha",
    pullRequestNumber: 21,
    repository,
    state: "open",
    title: "[Draft] Implementation pending: Add Post-Merge Closeout v0",
    url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21",
  },
  workOrder: parseCodexDispatchWorkOrder({
    markdown: workOrderMarkdown,
    path: workOrderPath,
  }),
};

function createService(overrides: Partial<CodexDispatchEvidence> = {}) {
  return {
    collectEvidence: vi.fn().mockResolvedValue({ ...evidence, ...overrides }),
  } as unknown as CodexDispatchService;
}

function createRepository(overrides: Partial<CodexDispatchTaskRepository> = {}) {
  const repository: CodexDispatchTaskRepository = {
    appendCodexDispatchResult: vi.fn().mockResolvedValue(undefined),
    fetchTask: vi.fn().mockResolvedValue(task),
    ...overrides,
  };

  return repository;
}

function createWorkflow(input: {
  repository?: CodexDispatchTaskRepository;
  service?: CodexDispatchService;
} = {}) {
  return new CodexDispatchWorkflow({
    dispatchService: input.service ?? createService(),
    now: () => new Date("2026-05-18T09:30:00.000Z"),
    taskRepository: input.repository ?? createRepository(),
  });
}

describe("CodexDispatchWorkflow", () => {
  it("creates a deterministic PR #21-style dispatch packet from work-order metadata", async () => {
    const { packet, plan } = createCodexDispatchPlan({
      evidence,
      request: {
        pullRequestNumber: 21,
        repository,
        taskId: pageId,
      },
      task,
    });

    expect(plan.directDispatch.status).toBe("unavailable_not_configured");
    expect(packet.markdown).toContain(`- Repository: ${repository}`);
    expect(packet.markdown).toContain(`- Implementation branch: ${branchName}`);
    expect(packet.markdown).toContain("- Pull request: #21");
    expect(packet.markdown).toContain(`- Work order file: ${workOrderPath}`);
    expect(packet.markdown).toContain(`- Task ID: ${pageId}`);
    expect(packet.markdown).toContain("Do not merge.");
    expect(packet.markdown).toContain("Review + Iteration Desk");
  });

  it("fails closed when required work-order metadata is missing", () => {
    const { repository: _repository, ...workOrderWithoutRepository } = evidence.workOrder;

    expect(() =>
      createCodexDispatchPlan({
        evidence: {
          ...evidence,
          workOrder: workOrderWithoutRepository,
        },
        request: {
          pullRequestNumber: 21,
          repository,
          taskId: pageId,
        },
        task,
      }),
    ).toThrow("Work order is missing Repository metadata");
  });

  it("fails closed when the work-order branch does not match the PR branch", () => {
    expect(() =>
      createCodexDispatchPlan({
        evidence: {
          ...evidence,
          workOrder: {
            ...evidence.workOrder,
            branchName: "agent-office/impl-different",
          },
        },
        request: {
          pullRequestNumber: 21,
          repository,
          taskId: pageId,
        },
        task,
      }),
    ).toThrow("does not match pull request branch");
  });

  it("previews without writing to Notion", async () => {
    const repository = createRepository();
    const workflow = createWorkflow({ repository });

    const result = await workflow.preview({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      dryRun: true,
      ok: true,
      statusUpdated: false,
      wroteToNotion: false,
      dispatch: {
        recorded: false,
      },
    });
    expect(repository.appendCodexDispatchResult).not.toHaveBeenCalled();
  });

  it("records the previewed packet after explicit approval", async () => {
    const repository = createRepository();
    const workflow = createWorkflow({ repository });
    const preview = await workflow.preview({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok || preview.dispatch.recorded) {
      throw new Error("Expected preview.");
    }

    const result = await workflow.record({ preview: preview.dispatch });

    expect(result).toMatchObject({
      dryRun: false,
      ok: true,
      statusUpdated: false,
      wroteToNotion: true,
      dispatch: {
        blockAppended: true,
        recorded: true,
      },
    });
    expect(repository.appendCodexDispatchResult).toHaveBeenCalledOnce();
  });

  it("revalidates the PR head SHA before recording", async () => {
    const repository = createRepository();
    const service = {
      collectEvidence: vi
        .fn()
        .mockResolvedValueOnce(evidence)
        .mockResolvedValueOnce({
          ...evidence,
          pullRequest: {
            ...evidence.pullRequest,
            headSha: "new-head-sha",
          },
        }),
    } as unknown as CodexDispatchService;
    const workflow = createWorkflow({ repository, service });
    const preview = await workflow.preview({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok || preview.dispatch.recorded) {
      throw new Error("Expected preview.");
    }

    const result = await workflow.record({ preview: preview.dispatch });

    expect(result).toMatchObject({
      ok: false,
      error: {
        message: expect.stringContaining("head SHA changed"),
        statusCode: 409,
      },
    });
    expect(service.collectEvidence).toHaveBeenCalledTimes(2);
    expect(repository.fetchTask).toHaveBeenCalledOnce();
    expect(repository.appendCodexDispatchResult).not.toHaveBeenCalled();
  });

  it("refuses to record when PR revalidation finds the PR closed", async () => {
    const repository = createRepository();
    const service = {
      collectEvidence: vi
        .fn()
        .mockResolvedValueOnce(evidence)
        .mockResolvedValueOnce({
          ...evidence,
          pullRequest: {
            ...evidence.pullRequest,
            state: "closed",
          },
        }),
    } as unknown as CodexDispatchService;
    const workflow = createWorkflow({ repository, service });
    const preview = await workflow.preview({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok || preview.dispatch.recorded) {
      throw new Error("Expected preview.");
    }

    const result = await workflow.record({ preview: preview.dispatch });

    expect(result).toMatchObject({
      ok: false,
      error: {
        message: expect.stringContaining("must still be open"),
        statusCode: 409,
      },
    });
    expect(service.collectEvidence).toHaveBeenCalledTimes(2);
    expect(repository.fetchTask).toHaveBeenCalledOnce();
    expect(repository.appendCodexDispatchResult).not.toHaveBeenCalled();
  });

  it("keeps direct Codex execution disabled in v0", async () => {
    const dispatcher = new DisabledDirectCodexDispatcher();

    await expect(dispatcher.dispatch()).resolves.toEqual({
      message: expect.stringContaining("unavailable"),
      status: "unavailable_not_configured",
    });
  });
});
