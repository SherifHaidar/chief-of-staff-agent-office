import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ArchitectBrief } from "../domain/architect-brief.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import { chunkBlocks, renderArchitectBriefBlocks } from "./notion-block-renderer.js";
import type { NotionAppendBlock, NotionClientLike, NotionTaskRepositoryConfig } from "./notion-types.js";

type ListBlocksResponse = {
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

function extractStatus(properties: Record<string, unknown>, statusPropertyName: string): string | undefined {
  const statusProperty = asRecord(properties[statusPropertyName]);

  if (statusProperty.type === "status") {
    return asString(asRecord(statusProperty.status).name);
  }

  if (statusProperty.type === "select") {
    return asString(asRecord(statusProperty.select).name);
  }

  return undefined;
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
