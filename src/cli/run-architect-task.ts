#!/usr/bin/env node
import "dotenv/config";

import { loadEnv } from "../config/env.js";
import { runArchitectTask } from "../index.js";

type CliArgs = {
  dryRun?: boolean;
  pageId?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--page-id") {
      args.pageId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg?.startsWith("--page-id=")) {
      args.pageId = arg.slice("--page-id=".length);
    }
  }

  return args;
}

function printUsage(): void {
  console.error("Usage: npm run architect -- --page-id <notion-page-id> [--dry-run]");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.pageId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const env = loadEnv();
  const result = await runArchitectTask(
    {
      dryRun: args.dryRun,
      pageId: args.pageId,
    },
    env,
  );

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
