import { describe, expect, it, vi } from "vitest";

import type { AiBuildTask } from "../../src/domain/ai-build-task.js";
import type {
  PostMergeCloseoutEvidence,
  PostMergeCloseoutPlan,
  PostMergeCloseoutPropertyWrite,
} from "../../src/domain/post-merge-closeout.js";
import { createPostMergeCloseoutPlan } from "../../src/domain/post-merge-closeout.js";
import type { PostMergeCloseoutService } from "../../src/github/post-merge-closeout.service.js";
import {
  PostMergeCloseoutWorkflow,
  type PostMergeCloseoutTaskRepository,
} from "../../src/workflows/post-merge-closeout.workflow.js";

const pageId = "22222222-2222-2222-2222-222222222222";

const evidence: PostMergeCloseoutEvidence = {
  collectedAt: "2026-05-17T12:00:00.000Z",
  deployment: {
    deployments: [{ environment: "Preview", state: "success", statuses: [], url: "https://preview.example" }],
    status: "found",
  },
  pullRequest: {
    baseBranch: "main",
    headBranch: "agent-office/impl-closeout",
    headSha: "head-sha",
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
};

const task: AiBuildTask = {
  contentMarkdown: "Task page content.",
  pageId,
  properties: {
    "Merge SHA": { rich_text: [], type: "rich_text" },
    "PR Link": { type: "url", url: null },
    Status: { select: { name: "In Codex" }, type: "select" },
  },
  status: "In Codex",
  title: "Post-Merge Closeout v0",
  url: "https://notion.example/task",
};

function createService(overrides: Partial<PostMergeCloseoutEvidence> = {}) {
  return {
    collectEvidence: vi.fn().mockResolvedValue({ ...evidence, ...overrides }),
  } as unknown as PostMergeCloseoutService;
}

function createRepository(overrides: Partial<PostMergeCloseoutTaskRepository> = {}) {
  const repository: PostMergeCloseoutTaskRepository = {
    appendPostMergeCloseoutResult: vi.fn().mockResolvedValue(undefined),
    createPostMergeCloseoutPlan: vi.fn(({ evidence: nextEvidence, mergedStatusName, task: nextTask }) =>
      createPostMergeCloseoutPlan({
        evidence: nextEvidence,
        mergedStatusName,
        statusPropertyName: "Status",
        statusPropertyType: "select",
        task: nextTask,
      }),
    ),
    fetchTask: vi.fn().mockResolvedValue(task),
    writePostMergeCloseoutProperties: vi.fn((_: string, plan: PostMergeCloseoutPlan) =>
      Promise.resolve(
        plan.propertyWrites.map(
          (write): PostMergeCloseoutPropertyWrite =>
            write.status === "planned" ? { ...write, status: "written" } : write,
        ),
      ),
    ),
    ...overrides,
  };

  return repository;
}

function createWorkflow(input: {
  repository?: PostMergeCloseoutTaskRepository;
  service?: PostMergeCloseoutService;
} = {}) {
  return new PostMergeCloseoutWorkflow({
    closeoutService: input.service ?? createService(),
    mergedStatusName: "Merged",
    now: () => new Date("2026-05-17T12:30:00.000Z"),
    taskRepository: input.repository ?? createRepository(),
  });
}

describe("PostMergeCloseoutWorkflow", () => {
  it("previews a merged PR closeout without writing to Notion", async () => {
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
      result: {
        committed: false,
        plan: {
          closeoutMarker: "post-merge-closeout:SherifHaidar/chief-of-staff-agent-office#21:merge-sha",
        },
      },
      statusUpdated: false,
      wroteToNotion: false,
    });
    expect(repository.writePostMergeCloseoutProperties).not.toHaveBeenCalled();
    expect(repository.appendPostMergeCloseoutResult).not.toHaveBeenCalled();
  });

  it("commits property updates and appends the closeout block after explicit commit", async () => {
    const repository = createRepository();
    const workflow = createWorkflow({ repository });

    const result = await workflow.commit({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      dryRun: false,
      ok: true,
      result: {
        blockAppended: true,
        committed: true,
        propertyWrites: expect.arrayContaining([
          expect.objectContaining({ name: "Status", status: "written", value: "Merged" }),
          expect.objectContaining({ name: "Merge SHA", status: "written", value: "merge-sha" }),
        ]),
      },
      statusUpdated: true,
      wroteToNotion: true,
    });
    expect(repository.writePostMergeCloseoutProperties).toHaveBeenCalledOnce();
    expect(repository.appendPostMergeCloseoutResult).toHaveBeenCalledOnce();
  });

  it("allows commit when the selected task PR Link matches the closeout PR", async () => {
    const repository = createRepository({
      fetchTask: vi.fn().mockResolvedValue({
        ...task,
        properties: {
          ...task.properties,
          "PR Link": { type: "url", url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21" },
        },
      }),
    });
    const workflow = createWorkflow({ repository });

    const result = await workflow.commit({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        plan: {
          taskPrLinkCheck: {
            status: "match",
          },
        },
      },
    });
    expect(repository.writePostMergeCloseoutProperties).toHaveBeenCalledOnce();
  });

  it("blocks commit when the selected task PR Link points to a different PR", async () => {
    const repository = createRepository({
      fetchTask: vi.fn().mockResolvedValue({
        ...task,
        properties: {
          ...task.properties,
          "PR Link": { type: "url", url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/20" },
        },
      }),
    });
    const workflow = createWorkflow({ repository });

    const result = await workflow.commit({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      error: {
        message: expect.stringContaining("points to SherifHaidar/chief-of-staff-agent-office#20"),
        statusCode: 409,
      },
      ok: false,
    });
    expect(repository.writePostMergeCloseoutProperties).not.toHaveBeenCalled();
    expect(repository.appendPostMergeCloseoutResult).not.toHaveBeenCalled();
  });

  it("allows commit when the selected task PR Link is empty and writes the closeout PR link", async () => {
    const repository = createRepository();
    const workflow = createWorkflow({ repository });

    const result = await workflow.commit({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        plan: {
          taskPrLinkCheck: {
            status: "empty",
          },
        },
        propertyWrites: expect.arrayContaining([
          expect.objectContaining({
            name: "PR Link",
            status: "written",
            value: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21",
          }),
        ]),
      },
    });
  });

  it("skips duplicate closeout block append when the same marker already exists", async () => {
    const repository = createRepository({
      fetchTask: vi.fn().mockResolvedValue({
        ...task,
        contentMarkdown: "post-merge-closeout:SherifHaidar/chief-of-staff-agent-office#21:merge-sha",
      }),
    });
    const workflow = createWorkflow({ repository });

    const result = await workflow.commit({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        blockAppended: false,
        committed: true,
      },
    });
    expect(repository.writePostMergeCloseoutProperties).toHaveBeenCalledOnce();
    expect(repository.appendPostMergeCloseoutResult).not.toHaveBeenCalled();
  });

  it("blocks commit when duplicate closeout markers are already present", async () => {
    const marker = "post-merge-closeout:SherifHaidar/chief-of-staff-agent-office#21:merge-sha";
    const repository = createRepository({
      fetchTask: vi.fn().mockResolvedValue({
        ...task,
        contentMarkdown: `${marker}\n${marker}`,
      }),
    });
    const workflow = createWorkflow({ repository });

    const result = await workflow.commit({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      error: {
        statusCode: 409,
      },
      ok: false,
    });
    expect(repository.writePostMergeCloseoutProperties).not.toHaveBeenCalled();
    expect(repository.appendPostMergeCloseoutResult).not.toHaveBeenCalled();
  });

  it("allows missing deployment evidence as non-blocking closeout evidence", async () => {
    const workflow = createWorkflow({
      service: createService({
        deployment: {
          deployments: [],
          message: "No GitHub deployment records were found for the merge commit.",
          status: "missing",
        },
      }),
    });

    const result = await workflow.preview({
      pullRequestNumber: 21,
      repository: "SherifHaidar/chief-of-staff-agent-office",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        diagnostics: {
          deploymentLookup: expect.stringContaining("missing"),
        },
      },
    });
  });

  it("supports closing out an external product PR against the Agent Office task", async () => {
    const service = createService({
      pullRequest: {
        ...evidence.pullRequest,
        pullRequestNumber: 6,
        repository: "SherifHaidar/personal-chief-of-staff",
        title: "Route quick tasks to Tasks DB",
        url: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/6",
      },
    });
    const workflow = createWorkflow({ service });

    const result = await workflow.preview({
      pullRequestNumber: 6,
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: pageId,
    });

    expect(result).toMatchObject({
      ok: true,
      pageId,
      result: {
        input: {
          repository: "SherifHaidar/personal-chief-of-staff",
          taskId: pageId,
        },
        notionTask: {
          pageId,
        },
      },
    });
  });
});
