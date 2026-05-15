import type { ProductContextPage, ProductContextNotionReader } from "../context/product-context-pack.builder.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { NotionClientLike } from "./notion-types.js";

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
      return title || "Untitled product context page";
    }
  }

  return "Untitled product context page";
}

export class NotionProductContextRepository implements ProductContextNotionReader {
  constructor(
    private readonly client: NotionClientLike,
    private readonly config: { maxReadDepth: number },
  ) {}

  async fetchProductContextPage(pageId: string): Promise<ProductContextPage> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const page = asRecord(await this.client.pages.retrieve({ page_id: normalizedPageId }));
    const properties = asRecord(page.properties);

    return {
      contentMarkdown: await this.readChildrenAsMarkdown(normalizedPageId, 0),
      pageId: normalizedPageId,
      title: extractTitle(properties),
      ...(asString(page.url) ? { url: asString(page.url) } : {}),
    };
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
      case "to_do":
        return `${indent}- [ ] ${text}`;
      case "quote":
        return `${indent}> ${text}`;
      case "code":
        return `${indent}\`\`\`\n${text}\n${indent}\`\`\``;
      case "divider":
        return `${indent}---`;
      case "paragraph":
      default:
        return `${indent}${text}`;
    }
  }
}
