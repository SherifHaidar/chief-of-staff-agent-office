import { JsonlRunLog } from "../audit/run-log.js";
import { AnthropicClaudeReviewRunner } from "../agents/claude-review.agent.js";
import type { AppEnv } from "../config/env.js";
import { GitHubAppClient } from "../github/github-app-client.js";
import { CodexDispatchService } from "../github/codex-dispatch.service.js";
import { GitHubDraftPrService } from "../github/github-draft-pr.service.js";
import { ImplementationService } from "../github/implementation.service.js";
import { PostMergeCloseoutService } from "../github/post-merge-closeout.service.js";
import { parseCsvList } from "../github/github-policy.js";
import { ReviewDeskService } from "../github/review-desk.service.js";
import {
  createArchitectTaskWorkflow,
  createCodexHandoffWorkflow,
  createNotionTaskRepository,
} from "../index.js";
import { consoleLogger } from "../utils/logger.js";
import { GitHubDraftPrWorkflow } from "../workflows/github-draft-pr.workflow.js";
import { CodexDispatchWorkflow } from "../workflows/codex-dispatch.workflow.js";
import { ImplementationWorkflow } from "../workflows/implementation.workflow.js";
import { PostMergeCloseoutWorkflow } from "../workflows/post-merge-closeout.workflow.js";
import { ReviewDeskWorkflow } from "../workflows/review-desk.workflow.js";
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

function createImplementationWorkflowIfConfigured(env: AppEnv, taskRepository: ReturnType<typeof createNotionTaskRepository>) {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return undefined;
  }

  const githubClient = new GitHubAppClient({
    appId: env.GITHUB_APP_ID,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });
  const implementationService = new ImplementationService(githubClient, {
    allowedBranchPrefixes: parseCsvList(env.GITHUB_ALLOWED_BRANCH_PREFIXES, ["agent-office/", "codex/"]),
    allowedRepositories: parseCsvList(env.GITHUB_ALLOWED_REPOS, [env.TARGET_PRODUCT_REPO]),
    defaultBaseBranch: env.GITHUB_DEFAULT_BASE_BRANCH,
    maxChangedFiles: env.IMPLEMENTATION_MAX_CHANGED_FILES,
    maxFileChars: env.IMPLEMENTATION_MAX_FILE_CHARS,
    maxTotalChangeChars: env.IMPLEMENTATION_MAX_TOTAL_CHANGE_CHARS,
  });

  return new ImplementationWorkflow({
    implementationService,
    logger: consoleLogger,
    taskRepository,
  });
}

function getMissingReviewDeskConfiguration(env: AppEnv): string[] {
  return [
    env.GITHUB_APP_ID ? undefined : "GITHUB_APP_ID",
    env.GITHUB_APP_INSTALLATION_ID ? undefined : "GITHUB_APP_INSTALLATION_ID",
    env.GITHUB_APP_PRIVATE_KEY ? undefined : "GITHUB_APP_PRIVATE_KEY",
    env.ANTHROPIC_API_KEY ? undefined : "ANTHROPIC_API_KEY",
    env.CLAUDE_REVIEW_MODEL ? undefined : "CLAUDE_REVIEW_MODEL",
  ].filter((value): value is string => Boolean(value));
}

function getMissingPostMergeCloseoutConfiguration(env: AppEnv): string[] {
  return [
    env.GITHUB_APP_ID ? undefined : "GITHUB_APP_ID",
    env.GITHUB_APP_INSTALLATION_ID ? undefined : "GITHUB_APP_INSTALLATION_ID",
    env.GITHUB_APP_PRIVATE_KEY ? undefined : "GITHUB_APP_PRIVATE_KEY",
  ].filter((value): value is string => Boolean(value));
}

function getMissingCodexDispatchConfiguration(env: AppEnv): string[] {
  return [
    env.GITHUB_APP_ID ? undefined : "GITHUB_APP_ID",
    env.GITHUB_APP_INSTALLATION_ID ? undefined : "GITHUB_APP_INSTALLATION_ID",
    env.GITHUB_APP_PRIVATE_KEY ? undefined : "GITHUB_APP_PRIVATE_KEY",
  ].filter((value): value is string => Boolean(value));
}

function createCodexDispatchWorkflowIfConfigured(env: AppEnv, taskRepository: ReturnType<typeof createNotionTaskRepository>) {
  const appId = env.GITHUB_APP_ID;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  if (getMissingCodexDispatchConfiguration(env).length > 0 || !appId || !installationId || !privateKey) {
    return undefined;
  }

  const githubClient = new GitHubAppClient({
    appId,
    installationId,
    privateKey,
  });
  const dispatchService = new CodexDispatchService(githubClient, {
    allowedRepositories: parseCsvList(env.GITHUB_ALLOWED_REPOS, [env.TARGET_PRODUCT_REPO]),
  });

  return new CodexDispatchWorkflow({
    dispatchService,
    logger: consoleLogger,
    taskRepository,
  });
}

function createPostMergeCloseoutWorkflowIfConfigured(env: AppEnv, taskRepository: ReturnType<typeof createNotionTaskRepository>) {
  const appId = env.GITHUB_APP_ID;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  if (getMissingPostMergeCloseoutConfiguration(env).length > 0 || !appId || !installationId || !privateKey) {
    return undefined;
  }

  const githubClient = new GitHubAppClient({
    appId,
    installationId,
    privateKey,
  });
  const closeoutService = new PostMergeCloseoutService(githubClient, {
    allowedRepositories: parseCsvList(env.GITHUB_ALLOWED_REPOS, [env.TARGET_PRODUCT_REPO]),
  });

  return new PostMergeCloseoutWorkflow({
    closeoutService,
    logger: consoleLogger,
    mergedStatusName: env.NOTION_STATUS_AFTER_POST_MERGE_CLOSEOUT,
    taskRepository,
  });
}

function createReviewDeskWorkflowIfConfigured(env: AppEnv, taskRepository: ReturnType<typeof createNotionTaskRepository>) {
  const apiKey = env.ANTHROPIC_API_KEY;
  const appId = env.GITHUB_APP_ID;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  const model = env.CLAUDE_REVIEW_MODEL;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  if (getMissingReviewDeskConfiguration(env).length > 0 || !apiKey || !appId || !installationId || !model || !privateKey) {
    return undefined;
  }

  const githubClient = new GitHubAppClient({
    appId,
    installationId,
    privateKey,
  });
  const reviewDeskService = new ReviewDeskService(githubClient, {
    allowedRepositories: parseCsvList(env.GITHUB_ALLOWED_REPOS, [env.TARGET_PRODUCT_REPO]),
    maxChangedFiles: env.REVIEW_DESK_MAX_CHANGED_FILES,
    maxPatchChars: env.REVIEW_DESK_MAX_PATCH_CHARS,
  });
  const reviewer = new AnthropicClaudeReviewRunner({
    apiKey,
    model,
  });

  return new ReviewDeskWorkflow({
    logger: consoleLogger,
    reviewDeskService,
    reviewer,
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
  const implementationWorkflow = createImplementationWorkflowIfConfigured(env, taskRepository);
  const missingCodexDispatchConfiguration = getMissingCodexDispatchConfiguration(env);
  const missingReviewDeskConfiguration = getMissingReviewDeskConfiguration(env);
  const missingPostMergeCloseoutConfiguration = getMissingPostMergeCloseoutConfiguration(env);
  const codexDispatchWorkflow = createCodexDispatchWorkflowIfConfigured(env, taskRepository);
  const postMergeCloseoutWorkflow = createPostMergeCloseoutWorkflowIfConfigured(env, taskRepository);
  const reviewDeskWorkflow = createReviewDeskWorkflowIfConfigured(env, taskRepository);
  const implementationReadyStatus = env.NOTION_STATUS_AFTER_CODEX_HANDOFF ?? "In Codex";

  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: workflow,
    approvedCodexHandoffWriter: codexHandoffWorkflow,
    approvedGitHubDraftPrWriter: githubDraftPrWorkflow,
    approvedImplementationWriter: implementationWorkflow,
    codexDispatchConfigurationMessage:
      missingCodexDispatchConfiguration.length > 0
        ? `Codex Dispatch is blocked until this configuration is set: ${missingCodexDispatchConfiguration.join(", ")}.`
        : undefined,
    codexDispatchWorkflow,
    codexHandoffWorkflow,
    githubDraftPrWorkflow,
    implementationReadyScanner: {
      findImplementationReadyTasks: () =>
        taskRepository.findImplementationReadyTasks({
          databaseId: taskDatabaseId,
          statusName: implementationReadyStatus,
        }),
      loadApprovedCodexHandoff: (taskId) =>
        taskRepository.loadApprovedCodexHandoffForImplementation({
          pageId: taskId,
          statusName: implementationReadyStatus,
        }),
    },
    implementationWorkflow,
    postMergeCloseoutConfigurationMessage:
      missingPostMergeCloseoutConfiguration.length > 0
        ? `Post-Merge Closeout is blocked until this configuration is set: ${missingPostMergeCloseoutConfiguration.join(", ")}.`
        : undefined,
    postMergeCloseoutWorkflow,
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
    reviewDeskConfigurationMessage:
      missingReviewDeskConfiguration.length > 0
        ? `Review + Iteration Desk is blocked until this configuration is set: ${missingReviewDeskConfiguration.join(", ")}.`
        : undefined,
    reviewDeskWorkflow,
    runLog: new JsonlRunLog(env.RUN_LOG_PATH),
    statusAfterCodexHandoff: env.NOTION_STATUS_AFTER_CODEX_HANDOFF,
    statusAfterWriteback: env.NOTION_STATUS_AFTER_ARCHITECT,
    targetProductRepo: env.TARGET_PRODUCT_REPO,
    workflow,
  });
}
