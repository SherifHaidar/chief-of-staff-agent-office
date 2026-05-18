import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ArchitectBrief } from "../domain/architect-brief.js";
import type { ArchitectBriefWritebackMetadata } from "../domain/architect-brief-writeback.js";
import type { CodexHandoffBrief } from "../domain/codex-handoff-brief.js";
import type { CodexDispatchRecordResult } from "../domain/codex-dispatch.js";
import type { GitHubDraftPrExecutionResult } from "../domain/github-draft-pr.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../domain/implementation-proposal.js";
import type {
  PostMergeCloseoutEvidence,
  PostMergeCloseoutPlan,
  PostMergeCloseoutPropertyWrite,
  PostMergeCloseoutResult,
} from "../domain/post-merge-closeout.js";
import { createPostMergeCloseoutPlan } from "../domain/post-merge-closeout.js";
import type { ReviewDeskResult } from "../domain/review-desk.js";
import type { ReadyArchitectureTask } from "../domain/ready-architecture-task.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import { parseLatestCodexHandoffBrief } from "./codex-handoff-brief-parser.js";
import {
  chunkBlocks,
  renderArchitectBriefBlocks,
  renderCodexHandoffBriefBlocks,
  renderCodexDispatchBlocks,
  renderGitHubDraftPrResultBlocks,
  renderImplementationResultBlocks,
  renderPostMergeCloseoutBlocks,
  renderReviewDeskResultBlocks,
} from "./notion-block-renderer.js";
import type { NotionClientLike, NotionTaskRepositoryConfig } from "./notion-types.js";

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

export type ApprovedCodexHandoffResume = {
  handoff: CodexHandoffBrief;
  status?: string;
  taskId: string;
  taskName: string;
};

export class ImplementationReadyTaskError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "ImplementationReadyTaskError";
  }
}

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

  async findTasksByStatus(input: { databaseId: string; statusName: string }): Promise<ReadyArchitectureTask[]> {
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

  async findReadyForArchitectureTasks(input: { databaseId: string; statusName: string }): Promise<ReadyArchitectureTask[]> {
    return this.findTasksByStatus(input);
  }

  async findImplementationReadyTasks(input: { databaseId: string; statusName: string }): Promise<ReadyArchitectureTask[]> {
    const tasks = await this.findTasksByStatus(input);
    const implementationReadyTasks: ReadyArchitectureTask[] = [];

    for (const task of tasks) {
      if (await this.hasCodexHandoffBrief(task.taskId)) {
        implementationReadyTasks.push(task);
      }
    }

    return implementationReadyTasks;
  }

  async hasArchitectBrief(pageId: string): Promise<boolean> {
    const task = await this.fetchTask(pageId);

    return task.contentMarkdown.includes("Architect Brief:");
  }

  async hasCodexHandoffBrief(pageId: string): Promise<boolean> {
    const task = await this.fetchTask(pageId);

    return task.contentMarkdown.includes("Codex Handoff Brief:");
  }

  async loadApprovedCodexHandoffForImplementation(input: {
    pageId: string;
    statusName: string;
  }): Promise<ApprovedCodexHandoffResume> {
    const task = await this.fetchTask(input.pageId);

    if (task.status !== input.statusName) {
      throw new ImplementationReadyTaskError(
        `Task must be ${input.statusName} before controlled implementation. Current status: ${task.status ?? "unknown"}.`,
      );
    }

    if (!task.contentMarkdown.includes("Codex Handoff Brief:")) {
      throw new ImplementationReadyTaskError(
        "Codex Handoff Brief must be approved and written to Notion before controlled implementation.",
      );
    }

    return {
      handoff: parseLatestCodexHandoffBrief(task.contentMarkdown),
      status: task.status,
      taskId: task.pageId,
      taskName: task.title,
    };
  }

  async appendArchitectBrief(
    pageId: string,
    brief: ArchitectBrief,
    generatedAt: Date,
    metadata?: ArchitectBriefWritebackMetadata,
  ): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderArchitectBriefBlocks(brief, generatedAt, metadata);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async appendCodexHandoffBrief(pageId: string, brief: CodexHandoffBrief, generatedAt: Date): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderCodexHandoffBriefBlocks(brief, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async appendCodexDispatchResult(pageId: string, result: CodexDispatchRecordResult, generatedAt: Date): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderCodexDispatchBlocks(result, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async appendGitHubDraftPrResult(pageId: string, result: GitHubDraftPrExecutionResult, generatedAt: Date): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderGitHubDraftPrResultBlocks(result, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async appendImplementationResult(
    pageId: string,
    result: ImplementationExecutionResult,
    proposal: ImplementationProposal,
    generatedAt: Date,
  ): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderImplementationResultBlocks(result, proposal, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async appendReviewDeskResult(pageId: string, result: ReviewDeskResult, generatedAt: Date): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderReviewDeskResultBlocks(result, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  createPostMergeCloseoutPlan(input: {
    evidence: PostMergeCloseoutEvidence;
    mergedStatusName: string;
    task: AiBuildTask;
  }): PostMergeCloseoutPlan {
    return createPostMergeCloseoutPlan({
      evidence: input.evidence,
      mergedStatusName: input.mergedStatusName,
      statusPropertyName: this.config.statusPropertyName,
      statusPropertyType: this.config.statusPropertyType,
      task: input.task,
    });
  }

  async writePostMergeCloseoutProperties(pageId: string, plan: PostMergeCloseoutPlan): Promise<PostMergeCloseoutPropertyWrite[]> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const properties = Object.fromEntries(
      plan.propertyWrites
        .filter((write) => write.status === "planned" && write.update)
        .map((write) => [write.name, write.update as Record<string, unknown>]),
    );
    const propertyWrites = plan.propertyWrites.map((write): PostMergeCloseoutPropertyWrite =>
      write.status === "planned" && write.update ? { ...write, status: "written" } : write,
    );

    if (Object.keys(properties).length > 0) {
      await this.client.pages.update({
        page_id: normalizedPageId,
        properties,
      });
    }

    return propertyWrites;
  }

  async appendPostMergeCloseoutResult(pageId: string, result: PostMergeCloseoutResult, generatedAt: Date): Promise<void> {
    const normalizedPageId = normalizeNotionPageId(pageId);
    const blocks = renderPostMergeCloseoutBlocks(result, generatedAt);

    for (const chunk of chunkBlocks(blocks)) {
      await this.client.blocks.children.append({
        block_id: normalizedPageId,
        children: chunk,
      });
    }
  }

  async markArchitectBriefReady(pageId: string, statusName: string): Promise<void> {
    await this.updateStatus(pageId, statusName);
  }

  async markCodexHandoffReady(pageId: string, statusName: string): Promise<void> {
    await this.updateStatus(pageId, statusName);
  }

  private async updateStatus(pageId: string, statusName: string): Promise<void> {
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
