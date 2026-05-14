import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AgentOfficeRunSummary } from "./run-summary.js";

export type RunLog = {
  record(summary: AgentOfficeRunSummary): Promise<void>;
};

export class JsonlRunLog implements RunLog {
  constructor(private readonly filePath: string) {}

  async record(summary: AgentOfficeRunSummary): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(summary)}\n`, "utf8");
  }
}

export class InMemoryRunLog implements RunLog {
  readonly records: AgentOfficeRunSummary[] = [];

  async record(summary: AgentOfficeRunSummary): Promise<void> {
    this.records.push(summary);
  }
}

export const noopRunLog: RunLog = {
  record: async () => undefined,
};
