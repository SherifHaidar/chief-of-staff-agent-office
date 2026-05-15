import { JsonlRunLog } from "../audit/run-log.js";
import type { AppEnv } from "../config/env.js";
import { createArchitectTaskWorkflow, createCodexHandoffWorkflow, createNotionTaskRepository } from "../index.js";
import { createAgentOfficeApp } from "./app.js";

export function requiredServerConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required to start the Agent Office API server.`);
  }

  return value;
}

export function createConfiguredAgentOfficeApp(env: AppEnv) {
  const apiKey = requiredServerConfig(env.AGENT_OFFICE_API_KEY, "AGENT_OFFICE_API_KEY");
  const approvalSecret = requiredServerConfig(env.AGENT_OFFICE_APPROVAL_SECRET, "AGENT_OFFICE_APPROVAL_SECRET");
  const taskDatabaseId = requiredServerConfig(env.NOTION_TASK_DATABASE_ID, "NOTION_TASK_DATABASE_ID");
  const taskRepository = createNotionTaskRepository(env);
  const workflow = createArchitectTaskWorkflow(env);
  const codexHandoffWorkflow = createCodexHandoffWorkflow(env);

  return createAgentOfficeApp({
    apiKey,
    approvalSecret,
    approvedBriefWriter: workflow,
    approvedCodexHandoffWriter: codexHandoffWorkflow,
    codexHandoffWorkflow,
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
