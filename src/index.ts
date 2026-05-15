import { createAgentRegistry } from "./agents/agent-registry.js";
import type { AppEnv } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { ProductContextPackBuilder } from "./context/product-context-pack.builder.js";
import { GitHubAppClient } from "./github/github-app-client.js";
import { ProductRepoContextService } from "./github/product-repo-context.service.js";
import { NotionProductContextRepository } from "./notion/product-context.repository.js";
import { createNotionClient } from "./notion/notion.client.js";
import { NotionTaskRepository } from "./notion/notion-task.repository.js";
import { consoleLogger } from "./utils/logger.js";
import { ArchitectTaskWorkflow } from "./workflows/architect-task.workflow.js";
import { CodexHandoffWorkflow } from "./workflows/codex-handoff.workflow.js";

export * from "./agents/architect.agent.js";
export * from "./agents/codex-handoff.agent.js";
export * from "./approval/architect-brief-approval.js";
export * from "./approval/codex-handoff-approval.js";
export * from "./approval/github-draft-pr-approval.js";
export * from "./audit/run-log.js";
export * from "./audit/run-summary.js";
export * from "./config/env.js";
export * from "./context/product-context-pack.builder.js";
export * from "./domain/ai-build-task.js";
export * from "./domain/architect-brief.js";
export * from "./domain/codex-handoff-brief.js";
export * from "./domain/github-draft-pr.js";
export * from "./domain/product-context-pack.js";
export * from "./domain/ready-architecture-task.js";
export * from "./github/github-app-client.js";
export * from "./github/github-draft-pr.service.js";
export * from "./github/github-policy.js";
export * from "./github/product-repo-context.service.js";
export * from "./notion/product-context.repository.js";
export * from "./notion/notion-task.repository.js";
export * from "./workflows/architect-task.workflow.js";
export * from "./workflows/codex-handoff.workflow.js";
export * from "./workflows/github-draft-pr.workflow.js";
export * from "./workflows/workflow-result.js";

export function createNotionTaskRepository(env: AppEnv): NotionTaskRepository {
  const notionClient = createNotionClient(env.NOTION_TOKEN);

  return new NotionTaskRepository(notionClient, {
    maxReadDepth: env.NOTION_MAX_READ_DEPTH,
    statusPropertyName: env.NOTION_STATUS_PROPERTY,
    statusPropertyType: env.NOTION_STATUS_PROPERTY_TYPE,
  });
}

function createGitHubAppClientIfConfigured(env: AppEnv): GitHubAppClient | undefined {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return undefined;
  }

  return new GitHubAppClient({
    appId: env.GITHUB_APP_ID,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });
}

export function createProductContextProvider(env: AppEnv): ProductContextPackBuilder | undefined {
  if (!env.PRODUCT_CONTEXT_PAGE_ID) {
    return undefined;
  }

  const notionClient = createNotionClient(env.NOTION_TOKEN);
  const githubClient = createGitHubAppClientIfConfigured(env);

  return new ProductContextPackBuilder({
    config: {
      maxFileChars: env.PRODUCT_CONTEXT_MAX_FILE_CHARS,
      maxFiles: env.PRODUCT_CONTEXT_MAX_FILES,
      maxNotionChars: env.PRODUCT_CONTEXT_MAX_NOTION_CHARS,
      maxTotalChars: env.PRODUCT_CONTEXT_MAX_TOTAL_CHARS,
      productContextPageId: env.PRODUCT_CONTEXT_PAGE_ID,
    },
    notionReader: new NotionProductContextRepository(notionClient, { maxReadDepth: env.NOTION_MAX_READ_DEPTH }),
    ...(githubClient
      ? {
          repoReader: new ProductRepoContextService(githubClient, {
            defaultBranch: env.GITHUB_DEFAULT_BASE_BRANCH,
            maxFileChars: env.PRODUCT_CONTEXT_MAX_FILE_CHARS,
            maxFiles: env.PRODUCT_CONTEXT_MAX_FILES,
          }),
        }
      : {}),
  });
}

export function createArchitectTaskWorkflow(env: AppEnv): ArchitectTaskWorkflow {
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;

  const taskRepository = createNotionTaskRepository(env);
  const agents = createAgentRegistry({ model: env.OPENAI_MODEL });
  const productContextProvider = createProductContextProvider(env);

  return new ArchitectTaskWorkflow({
    architect: agents.architect,
    logger: consoleLogger,
    productContextProvider,
    taskRepository,
    targetProductRepo: env.TARGET_PRODUCT_REPO,
  });
}

export function createCodexHandoffWorkflow(env: AppEnv): CodexHandoffWorkflow {
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;

  const taskRepository = createNotionTaskRepository(env);
  const agents = createAgentRegistry({ model: env.OPENAI_MODEL });
  const productContextProvider = createProductContextProvider(env);

  return new CodexHandoffWorkflow({
    codexHandoff: agents.codexHandoff,
    logger: consoleLogger,
    productContextProvider,
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

export async function runCodexHandoff(input: { pageId: string; dryRun?: boolean }, env = loadEnv()) {
  const workflow = createCodexHandoffWorkflow(env);

  return workflow.run({
    dryRun: input.dryRun ?? true,
    pageId: input.pageId,
    statusAfterWriteback: env.NOTION_STATUS_AFTER_CODEX_HANDOFF,
    targetProductRepo: env.TARGET_PRODUCT_REPO,
  });
}
