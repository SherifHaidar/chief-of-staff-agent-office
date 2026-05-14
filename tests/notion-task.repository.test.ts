import { describe, expect, it, vi } from "vitest";

import { NotionTaskRepository } from "../src/notion/notion-task.repository.js";
import type { NotionClientLike } from "../src/notion/notion-types.js";

const pageId = "22222222-2222-2222-2222-222222222222";

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
});
