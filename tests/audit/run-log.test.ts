import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { JsonlRunLog } from "../../src/audit/run-log.js";
import type { AgentOfficeRunSummary } from "../../src/audit/run-summary.js";

const summary: AgentOfficeRunSummary = {
  briefGenerated: true,
  dryRun: true,
  finishedAt: "2026-05-14T12:00:01.000Z",
  notionWriteback: false,
  outcome: "succeeded",
  runId: "run_test",
  startedAt: "2026-05-14T12:00:00.000Z",
  statusUpdated: false,
  taskId: "11111111-1111-1111-1111-111111111111",
  taskName: "Test task",
  workflow: "architect-review",
};

describe("JsonlRunLog", () => {
  it("appends one JSON object per line", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-office-run-log-"));
    const filePath = join(directory, "nested", "run-log.jsonl");

    try {
      const runLog = new JsonlRunLog(filePath);

      await runLog.record(summary);
      await runLog.record({ ...summary, runId: "run_test_2" });

      const lines = (await readFile(filePath, "utf8")).trim().split("\n");

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ runId: "run_test", taskName: "Test task" });
      expect(JSON.parse(lines[1] ?? "{}")).toMatchObject({ runId: "run_test_2", taskName: "Test task" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
