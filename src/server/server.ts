#!/usr/bin/env node
import "dotenv/config";

import { JsonlRunLog } from "../audit/run-log.js";
import { loadEnv } from "../config/env.js";
import { createArchitectTaskWorkflow, createNotionTaskRepository } from "../index.js";
import { createAgentOfficeApp } from "./app.js";

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000");

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function requiredConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required to start the Agent Office API server.`);
  }

  return value;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const taskDatabaseId = requiredConfig(env.NOTION_TASK_DATABASE_ID, "NOTION_TASK_DATABASE_ID");
  const taskRepository = createNotionTaskRepository(env);
  const app = createAgentOfficeApp({
    readyArchitectureScanner: {
      findReadyForArchitectureTasks: () =>
        taskRepository.findReadyForArchitectureTasks({
          databaseId: taskDatabaseId,
          statusName: env.NOTION_READY_FOR_ARCHITECTURE_STATUS,
        }),
      hasArchitectBrief: (taskId) => taskRepository.hasArchitectBrief(taskId),
    },
    runLog: new JsonlRunLog(env.RUN_LOG_PATH),
    statusAfterWriteback: env.NOTION_STATUS_AFTER_ARCHITECT,
    workflow: createArchitectTaskWorkflow(env),
  });

  const host = process.env.HOST ?? "127.0.0.1";
  const port = parsePort(process.env.PORT);

  await app.listen({ host, port });
  console.log(`Agent Office API listening on http://${host}:${port}`);
  console.log(`Agent Office run log: ${env.RUN_LOG_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
