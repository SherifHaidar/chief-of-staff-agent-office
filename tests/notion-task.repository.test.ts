import { describe, expect, it, vi } from "vitest";

import type { CodexHandoffBrief } from "../src/domain/codex-handoff-brief.js";
import { renderCodexHandoffBriefBlocks } from "../src/notion/notion-block-renderer.js";
import { NotionTaskRepository } from "../src/notion/notion-task.repository.js";
import type { NotionClientLike } from "../src/notion/notion-types.js";

const pageId = "22222222-2222-2222-2222-222222222222";
const secondPageId = "33333333-3333-3333-3333-333333333333";

const handoff: CodexHandoffBrief = {
  acceptanceChecklist: ["Tasks DB receives the row."],
  constraints: ["Do not merge or deploy automatically."],
  explicitApprovalWarnings: ["Merge requires Sherif approval.", "Deployment requires Sherif approval."],
  implementationScope: ["Implement the smallest Tasks DB write path."],
  implementationSteps: ["Inspect capture", "Implement", "Test"],
  likelyAffectedFiles: ["lib/notion.ts"],
  problemSummary: "Weekly To-do insertion needs a durable replacement.",
  productIntent: "Make task capture queryable.",
  suggestedBranchName: "codex/tasks-db-v0",
  suggestedPrBody: "## Summary\n- Add Tasks DB write path",
  suggestedPrTitle: "Design Tasks DB",
  targetProductRepo: "SherifHaidar/personal-chief-of-staff",
  testsToRun: ["npm test"],
};

function createClient(overrides: Partial<NotionClientLike> = {}): NotionClientLike {
  return {
    blocks: {
      children: {
        append: vi.fn().mockResolvedValue({}),
        list: vi.fn().mockResolvedValue({ results: [] }),
      },
    },
    databases: {
      query: vi.fn().mockResolvedValue({ results: [] }),
    },
    pages: {
      retrieve: vi.fn().mockResolvedValue({ properties: {} }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function createRepository(client: NotionClientLike): NotionTaskRepository {
  return new NotionTaskRepository(client, {
    maxReadDepth: 1,
    statusPropertyName: "Status",
    statusPropertyType: "status",
  });
}

describe("NotionTaskRepository ready architecture scanning", () => {
  it("queries the task database for Ready for Architecture tasks", async () => {
    const query = vi.fn().mockResolvedValue({
      results: [
        {
          id: pageId,
          properties: {
            Name: {
              title: [{ plain_text: "Build scanner" }],
              type: "title",
            },
            Priority: {
              select: { name: "High" },
              type: "select",
            },
            Status: {
              status: { name: "Ready for Architecture" },
              type: "status",
            },
          },
        },
      ],
    });
    const client = createClient({ databases: { query } });
    const repository = createRepository(client);

    const tasks = await repository.findReadyForArchitectureTasks({
      databaseId: "database-id",
      statusName: "Ready for Architecture",
    });

    expect(query).toHaveBeenCalledWith({
      database_id: "database-id",
      filter: {
        property: "Status",
        status: { equals: "Ready for Architecture" },
      },
      page_size: 100,
      start_cursor: undefined,
    });
    expect(tasks).toEqual([
      {
        name: "Build scanner",
        priority: "High",
        status: "Ready for Architecture",
        taskId: pageId,
      },
    ]);
  });

  it("detects an existing Architect Brief marker in page content", async () => {
    const client = createClient({
      blocks: {
        children: {
          append: vi.fn().mockResolvedValue({}),
          list: vi.fn().mockResolvedValue({
            results: [
              {
                heading_2: { rich_text: [{ plain_text: "Architect Brief: Existing" }] },
                type: "heading_2",
              },
            ],
          }),
        },
      },
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          properties: {
            Name: {
              title: [{ plain_text: "Already processed" }],
              type: "title",
            },
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const repository = createRepository(client);

    await expect(repository.hasArchitectBrief(pageId)).resolves.toBe(true);
  });

  it("lists only In Codex tasks with an approved Codex Handoff marker as implementation-ready", async () => {
    const query = vi.fn().mockResolvedValue({
      results: [
        {
          id: pageId,
          properties: {
            Name: {
              title: [{ plain_text: "Design Tasks DB" }],
              type: "title",
            },
            Status: {
              status: { name: "In Codex" },
              type: "status",
            },
          },
        },
        {
          id: secondPageId,
          properties: {
            Name: {
              title: [{ plain_text: "Missing handoff" }],
              type: "title",
            },
            Status: {
              status: { name: "In Codex" },
              type: "status",
            },
          },
        },
      ],
    });
    const list = vi.fn().mockImplementation(({ block_id }: { block_id: string }) =>
      Promise.resolve({
        results:
          block_id === pageId
            ? [{ heading_2: { rich_text: [{ plain_text: "Codex Handoff Brief: Design Tasks DB" }] }, type: "heading_2" }]
            : [{ paragraph: { rich_text: [{ plain_text: "No handoff yet." }] }, type: "paragraph" }],
      }),
    );
    const client = createClient({
      blocks: { children: { append: vi.fn().mockResolvedValue({}), list } },
      databases: { query },
      pages: {
        retrieve: vi.fn().mockResolvedValue({ properties: {} }),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const repository = createRepository(client);

    const tasks = await repository.findImplementationReadyTasks({
      databaseId: "database-id",
      statusName: "In Codex",
    });

    expect(tasks).toEqual([
      {
        name: "Design Tasks DB",
        status: "In Codex",
        taskId: pageId,
      },
    ]);
  });

  it("loads the approved Codex Handoff for an implementation-ready task", async () => {
    const client = createClient({
      blocks: {
        children: {
          append: vi.fn().mockResolvedValue({}),
          list: vi.fn().mockResolvedValue({
            results: renderCodexHandoffBriefBlocks(handoff, new Date("2026-05-16T12:00:00.000Z")),
          }),
        },
      },
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          properties: {
            Name: {
              title: [{ plain_text: "Design Tasks DB" }],
              type: "title",
            },
            Status: {
              status: { name: "In Codex" },
              type: "status",
            },
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const repository = createRepository(client);

    await expect(
      repository.loadApprovedCodexHandoffForImplementation({
        pageId,
        statusName: "In Codex",
      }),
    ).resolves.toEqual({
      handoff,
      status: "In Codex",
      taskId: pageId,
      taskName: "Design Tasks DB",
    });
  });

  it("rejects handoff resume when the task is not In Codex", async () => {
    const client = createClient({
      blocks: {
        children: {
          append: vi.fn().mockResolvedValue({}),
          list: vi.fn().mockResolvedValue({
            results: renderCodexHandoffBriefBlocks(handoff, new Date("2026-05-16T12:00:00.000Z")),
          }),
        },
      },
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          properties: {
            Name: {
              title: [{ plain_text: "Design Tasks DB" }],
              type: "title",
            },
            Status: {
              status: { name: "Ready for Codex" },
              type: "status",
            },
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const repository = createRepository(client);

    await expect(
      repository.loadApprovedCodexHandoffForImplementation({
        pageId,
        statusName: "In Codex",
      }),
    ).rejects.toThrow("Task must be In Codex before controlled implementation. Current status: Ready for Codex.");
  });

  it("plans and writes supported Post-Merge Closeout task properties", async () => {
    const update = vi.fn().mockResolvedValue({});
    const client = createClient({
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          properties: {
            "Merge SHA": { rich_text: [], type: "rich_text" },
            "PR Link": { type: "url", url: null },
            Status: { select: { name: "In Codex" }, type: "select" },
          },
        }),
        update,
      },
    });
    const repository = createRepository(client);
    const task = {
      contentMarkdown: "Task page content.",
      pageId,
      properties: {
        "Merge SHA": { rich_text: [], type: "rich_text" },
        "PR Link": { type: "url", url: null },
        Status: { select: { name: "In Codex" }, type: "select" },
      },
      status: "In Codex",
      title: "Post-Merge Closeout v0",
    };
    const plan = repository.createPostMergeCloseoutPlan({
      evidence: {
        collectedAt: "2026-05-17T12:00:00.000Z",
        deployment: { deployments: [], message: "No deployment evidence.", status: "missing" },
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
      mergedStatusName: "Merged",
      task,
    });

    const writes = await repository.writePostMergeCloseoutProperties(pageId, plan);

    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Status", status: "written", value: "Merged" }),
        expect.objectContaining({ name: "PR Link", status: "written" }),
        expect.objectContaining({ name: "Merge SHA", status: "written", value: "merge-sha" }),
      ]),
    );
    expect(update).toHaveBeenCalledWith({
      page_id: pageId,
      properties: expect.objectContaining({
        "Merge SHA": { rich_text: [{ text: { content: "merge-sha" }, type: "text" }] },
        "PR Link": { url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21" },
        Status: { select: { name: "Merged" } },
      }),
    });
  });
});
