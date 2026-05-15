import { JsonlRunLog } from "../audit/run-log.js";
import type { AppEnv } from "../config/env.js";
import { GitHubAppClient } from "../github/github-app-client.js";
import { GitHubDraftPrService } from "../github/github-draft-pr.service.js";
import { parseCsvList } from "../github/github-policy.js";
import { createArchitectTaskWorkflow, createCodexHandoffWorkflow, createNotionTaskRepository } from "../index.js";
import { consoleLogger } from "../utils/logger.js";
import { GitHubDraftPrWorkflow } from "../workflows/github-draft-pr.workflow.js";
import { createAgentOfficeApp } from "./app.js";

export function requiredServerConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required to start the Agent Office API server.`);
  }

  return value;
}

function createGitHubDraftPrWorkflowIfConfigured(env: AppEnv, taskRepository: ReturnType<typeof createNotionTaskRepository>) {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return undefined;
  }

  const githubClient = new GitHubAppClient({
    appId: env.GITHUB_APP_ID,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });
  const githubDraftPrService = new GitHubDraftPrService(githubClient, {
    allowedBranchPrefixes: parseCsvList(env.GITHUB_ALLOWED_BRANCH_PREFIXES, ["agent-office/", "codex/"]),
    allowedRepositories: parseCsvList(env.GITHUB_ALLOWED_REPOS, [env.TARGET_PRODUCT_REPO]),
    defaultBaseBranch: env.GITHUB_DEFAULT_BASE_BRANCH,
  });

  return new GitHubDraftPrWorkflow({
    githubDraftPrService,
    logger: consoleLogger,
    taskRepository,
  });
}

export function createConfiguredAgentOfficeApp(env: AppEnv) {
  const apiKey = requiredServerConfig(env.AGENT_OFFICE_API_KEY, "AGENT_OFFICE_API_KEY");
  const approvalSecret = requiredServerConfig(env.AGENT_OFFICE_APPROVAL_SECRET, "AGENT_OFFICE_APPROVAL_SECRET");
  const taskDatabaseId = requiredServerConfig(env.NOTION_TASK_DATABASE_ID, "NOTION_TASK_DATABASE_ID");
  const taskRepository = createNotionTaskRepository(env);
  const workflow = createArchitectTaskWorkflow(env);
  const codexHandoffWorkflow = createCodexHandoffWorkflow(env);
  const githubDraftPrWorkflow = createGitHubDraftPrWorkflowIfConfigured(env, taskRepository);

  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: workflow,
    approvedCodexHandoffWriter: codexHandoffWorkflow,
    approvedGitHubDraftPrWriter: githubDraftPrWorkflow,
    codexHandoffWorkflow,
    githubDraftPrWorkflow,
    readyArchitectureScanner: {
      findReadyForArchitectureTasks: () =>
        taskRepository.findReadyForArchitectureTasks({
          databaseId: taskDatabaseId,
          statusName: env.NOTION_READY_FOR_ARCHITECTURE_STATUS,
        }),
      hasArchitectBrief: (taskId) => taskRepository.hasArchitectBrief(taskId),
    },
    readyCodexScanner: {
      findReadyForCodexTasks: () =>
        taskRepository.findTasksByStatus({
          databaseId: taskDatabaseId,
          statusName: env.NOTION_READY_FOR_CODEX_STATUS,
        }),
      hasCodexHandoffBrief: (taskId) => taskRepository.hasCodexHandoffBrief(taskId),
    },
    runLog: new JsonlRunLog(env.RUN_LOG_PATH),
    statusAfterCodexHandoff: env.NOTION_STATUS_AFTER_CODEX_HANDOFF,
    statusAfterWriteback: env.NOTION_STATUS_AFTER_ARCHITECT,
    targetProductRepo: env.TARGET_PRODUCT_REPO,
    workflow,
  });
}
