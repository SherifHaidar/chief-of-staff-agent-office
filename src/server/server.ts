#!/usr/bin/env node
import "dotenv/config";

import { loadEnv } from "../config/env.js";
import { createArchitectTaskWorkflow } from "../index.js";
import { createAgentOfficeApp } from "./app.js";

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000");

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const app = createAgentOfficeApp({
    statusAfterWriteback: env.NOTION_STATUS_AFTER_ARCHITECT,
    workflow: createArchitectTaskWorkflow(env),
  });

  const host = process.env.HOST ?? "127.0.0.1";
  const port = parsePort(process.env.PORT);

  await app.listen({ host, port });
  console.log(`Agent Office API listening on http://${host}:${port}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
