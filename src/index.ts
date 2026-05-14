import { createAgentRegistry } from "./agents/agent-registry.js";
import type { AppEnv } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { createNotionClient } from "./notion/notion.client.js";
import { NotionTaskRepository } from "./notion/notion-task.repository.js";
import { consoleLogger } from "./utils/logger.js";
import { ArchitectTaskWorkflow } from "./workflows/architect-task.workflow.js";

export * from "./agents/architect.agent.js";
export * from "./audit/run-log.js";
export * from "./audit/run-summary.js";
export * from "./config/env.js";
export * from "./domain/ai-build-task.js";
export * from "./domain/architect-brief.js";
export * from "./domain/ready-architecture-task.js";
export * from "./notion/notion-task.repository.js";
export * from "./workflows/architect-task.workflow.js";
export * from "./workflows/workflow-result.js";

export function createNotionTaskRepository(env: AppEnv): NotionTaskRepository {
  const notionClient = createNotionClient(env.NOTION_TOKEN);

  return new NotionTaskRepository(notionClient, {
    maxReadDepth: env.NOTION_MAX_READ_DEPTH,
    statusPropertyName: env.NOTION_STATUS_PROPERTY,
    statusPropertyType: env.NOTION_STATUS_PROPERTY_TYPE,
  });
}

export function createArchitectTaskWorkflow(env: AppEnv): ArchitectTaskWorkflow {
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;

  const taskRepository = createNotionTaskRepository(env);
  const agents = createAgentRegistry({ model: env.OPENAI_MODEL });

  return new ArchitectTaskWorkflow({
    architect: agents.architect,
    logger: consoleLogger,
    taskRepository,
  });
}

export async function runArchitectTask(input: { pageId: string; dryRun?: boolean }, env = loadEnv()) {
  const workflow = createArchitectTaskWorkflow(env);

  return workflow.run({
    dryRun: input.dryRun ?? env.DRY_RUN,
    pageId: input.pageId,
    statusAfterWriteback: env.NOTION_STATUS_AFTER_ARCHITECT,
  });
}
