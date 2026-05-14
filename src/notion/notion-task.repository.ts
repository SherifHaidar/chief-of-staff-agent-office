import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ArchitectBrief } from "../domain/architect-brief.js";
import type { ReadyArchitectureTask } from "../domain/ready-architecture-task.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import { chunkBlocks, renderArchitectBriefBlocks } from "./notion-block-renderer.js";
import type { NotionAppendBlock, NotionClientLike, NotionTaskRepositoryConfig } from "./notion-types.js";

type ListBlocksResponse = {
  has_more?: boolean;
  next_cursor?: string | null;
  results?: unknown[];
};

type QueryDatabaseResponse = {
  has_more?: boolean;
  next_cursor?: string | null;
  results?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function richTextToPlainText(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      const record = asRecord(part);
      const plainText = asString(record.plain_text);
      if (plainText) {
        return plainText;
      }

      const text = asRecord(record.text);
      return asString(text.content) ?? "";
    })
    .join("");
}

function extractTitle(properties: Record<string, unknown>): string {
  for (const property of Object.values(properties)) {
    const record = asRecord(property);

    if (record.type === "title") {
      const title = richTextToPlainText(record.title);
      return title || "Untitled Notion task";
    }
  }

  return "Untitled Notion task";
}

function extractNamedOption(property: Record<string, unknown>, type: "select" | "status"): string | undefined {
  return asString(asRecord(property[type]).name);
}

function extractPriority(properties: Record<string, unknown>): number | string | undefined {
  const priorityEntry = Object.entries(properties).find(([name]) => name.toLowerCase() === "priority");
  if (!priorityEntry) {
    return undefined;
  }

  const property = asRecord(priorityEntry[1]);

  switch (property.type) {
    case "number":
      return asNumber(property.number);
    case "select":
      return extractNamedOption(property, "select");
    case "status":
      return extractNamedOption(property, "status");
    case "rich_text": {
      const value = richTextToPlainText(property.rich_text);
      return value || undefined;
    }
    case "title": {
      const value = richTextToPlainText(property.title);
      return value || undefined;
    }
    default:
      return undefined;
  }
}

function extractStatus(properties: Record<string, unknown>, statusPropertyName: string): string | undefined {
  const statusProperty = asRecord(properties[statusPropertyName]);

  if (statusProperty.type === "status") {
    return extractNamedOption(statusProperty, "status");
  }

  if (statusProperty.type === "select") {
    return extractNamedOption(statusProperty, "select");
  }

  return undefined;
}

function statusFilter(statusPropertyName: string, statusPropertyType: "select" | "status", statusName: string) {
  return {
    property: statusPropertyName,
    [statusPropertyType]: {
      equals: statusName,
    },
  };
}

export class NotionTaskRepository {
  constructor(
    private readonly client: NotionClientLike,
    private readonly config: NotionTaskRepositoryConfig,
  ) {}

  async fetchTask(pageId: string): Promise<AiBuildTask> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const page = asRecord(await this.client.pages.retrieve({ page_id: normalizedPageId }));
    const properties = asRecord(page.properties);

    return {
      contentMarkdown: await this.readChildrenAsMarkdown(normalizedPageId, 0),
      pageId: normalizedPageId,
      properties,
      status: extractStatus(properties, this.config.statusPropertyName),
      title: extractTitle(properties),
      url: asString(page.url),
    };
  }

  async findReadyForArchitectureTasks(input: { databaseId: string; statusName: string }): Promise<ReadyArchitectureTask[]> {
    const tasks: ReadyArchitectureTask[] = [];
    let cursor: string | undefined;

    do {
      const response = (await this.client.databases.query({
        database_id: input.databaseId,
        filter: statusFilter(this.config.statusPropertyName, this.config.statusPropertyType, input.statusName),
        page_size: 100,
        start_cursor: cursor,
      })) as QueryDatabaseResponse;

      for (const page of response.results ?? []) {
        const record = asRecord(page);
        const rawPageId = asString(record.id);
        if (!rawPageId) {
          continue;
        }

        const properties = asRecord(record.properties);
        const task: ReadyArchitectureTask = {
          name: extractTitle(properties),
          status: extractStatus(properties, this.config.statusPropertyName) ?? input.statusName,
          taskId: normalizeNotionPageId(rawPageId),
        };
        const priority = extractPriority(properties);

        if (priority !== undefined) {
          task.priority = priority;
        }

        tasks.push(task);
      }

      cursor = response.next_cursor ?? undefined;
    } while (cursor);

    return tasks;
  }

  async hasArchitectBrief(pageId: string): Promise<boolean> {
    const task = await this.fetchTask(pageId);

    return task.contentMarkdown.includes("Architect Brief:");
  }

  async appendArchitectBrief(pageId: string, brief: ArchitectBrief, generatedAt: Date): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderArchitectBriefBlocks(brief, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async markArchitectBriefReady(pageId: string, statusName: string): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const propertyValue =
      this.config.statusPropertyType === "select"
        ? { select: { name: statusName } }
        : { status: { name: statusName } };

    await this.client.pages.update({
      page_id: normalizedPageId,
      properties: {
        [this.config.statusPropertyName]: propertyValue,
      },
    });
  }

  private async readChildrenAsMarkdown(blockId: string, depth: number): Promise<string> {
    const lines: string[] = [];
    let cursor: string | undefined;

    do {
      const response = (await this.client.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      })) as ListBlocksResponse;

      for (const block of response.results ?? []) {
        const record = asRecord(block);
        const line = this.blockToMarkdown(record, depth);

        if (line) {
          lines.push(line);
        }

        const childBlockId = asString(record.id);
        if (record.has_children === true && childBlockId && depth < this.config.maxReadDepth) {
          const childMarkdown = await this.readChildrenAsMarkdown(childBlockId, depth + 1);
          if (childMarkdown) {
            lines.push(childMarkdown);
          }
        }
      }

      cursor = response.next_cursor ?? undefined;
    } while (cursor);

    return lines.join("\n").trim();
  }

  private blockToMarkdown(block: Record<string, unknown>, depth: number): string | undefined {
    const type = asString(block.type);
    if (!type) {
      return undefined;
    }

    const value = asRecord(block[type]);
    const text = richTextToPlainText(value.rich_text);
    const indent = "  ".repeat(depth);

    if (!text && !["divider"].includes(type)) {
      return undefined;
    }

    switch (type) {
      case "heading_1":
        return `${indent}# ${text}`;
      case "heading_2":
        return `${indent}## ${text}`;
      case "heading_3":
        return `${indent}### ${text}`;
      case "bulleted_list_item":
        return `${indent}- ${text}`;
      case "numbered_list_item":
        return `${indent}1. ${text}`;
      case "to_do": {
        const checked = value.checked === true ? "x" : " ";
        return `${indent}- [${checked}] ${text}`;
      }
      case "quote":
        return `${indent}> ${text}`;
      case "code":
        return `${indent}\`\`\`\n${text}\n${indent}\`\`\``;
      case "callout":
      case "paragraph":
      case "toggle":
        return `${indent}${text}`;
      case "divider":
        return `${indent}---`;
      default:
        return text ? `${indent}${text}` : undefined;
    }
  }
}
