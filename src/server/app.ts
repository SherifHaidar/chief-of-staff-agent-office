import { createHash, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import type { RunLog } from "../audit/run-log.js";
import { noopRunLog } from "../audit/run-log.js";
import type { AgentOfficeRunSummary } from "../audit/run-summary.js";
import { createRunId } from "../audit/run-summary.js";
import type { ReadyArchitectureTask } from "../domain/ready-architecture-task.js";
import type { ArchitectTaskWorkflowInput } from "../workflows/architect-task.workflow.js";
import type { WorkflowResult } from "../workflows/workflow-result.js";

const API_KEY_HEADER = "x-agent-office-api-key";
const AGENT_OFFICE_ROUTE_PREFIX = "/agent-office/";

export type ArchitectReviewWorkflow = {
  run(input: ArchitectTaskWorkflowInput): Promise<WorkflowResult>;
};

export type ReadyArchitectureTaskScanner = {
  findReadyForArchitectureTasks(): Promise<ReadyArchitectureTask[]>;
  hasArchitectBrief(taskId: string): Promise<boolean>;
};

export type AgentOfficeAppOptions = {
  apiKey: string;
  readyArchitectureScanner: ReadyArchitectureTaskScanner;
  runLog?: RunLog;
  statusAfterWriteback: string;
  workflow: ArchitectReviewWorkflow;
};

const ArchitectReviewRequestSchema = z
  .object({
    dryRun: z.boolean().default(true),
    taskId: z.string().trim().min(1, "taskId is required"),
  })
  .strict();

const RunReadyArchitectureRequestSchema = z
  .object({
    dryRun: z.boolean().default(true),
  })
  .strict();

function getTaskIdFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const taskId = (body as { taskId?: unknown }).taskId;
  return typeof taskId === "string" ? taskId : undefined;
}

function formatValidationError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Invalid request. ${details}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function getHttpStatusCode(error: unknown): number {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return 500;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
}

function workflowErrorStatus(errorMessage: string): number {
  return errorMessage.startsWith("Invalid Notion page ID") ? 400 : 500;
}

function hashApiKey(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function isAuthorizedApiKey(headerValue: unknown, expectedApiKey: string): boolean {
  if (typeof headerValue !== "string") {
    return false;
  }

  return timingSafeEqual(hashApiKey(headerValue), hashApiKey(expectedApiKey));
}

function requireConfiguredApiKey(apiKey: string): string {
  if (apiKey.trim().length === 0) {
    throw new Error("Agent Office API key must be configured.");
  }

  return apiKey;
}

function withOptionalFields(
  summary: AgentOfficeRunSummary,
  optional: { error?: string; reason?: string; taskName?: string },
): AgentOfficeRunSummary {
  return {
    ...summary,
    ...(optional.error ? { error: optional.error } : {}),
    ...(optional.reason ? { reason: optional.reason } : {}),
    ...(optional.taskName ? { taskName: optional.taskName } : {}),
  };
}

function buildRunSummary(input: {
  dryRun: boolean;
  error?: string;
  finishedAt: Date;
  reason?: string;
  result?: WorkflowResult;
  runId: string;
  startedAt: Date;
  taskId: string;
  taskName?: string;
}): AgentOfficeRunSummary {
  const base = {
    dryRun: input.dryRun,
    finishedAt: input.finishedAt.toISOString(),
    runId: input.runId,
    startedAt: input.startedAt.toISOString(),
    workflow: "architect-review" as const,
  };

  if (input.reason) {
    return withOptionalFields(
      {
        ...base,
        briefGenerated: false,
        notionWriteback: false,
        outcome: "skipped",
        statusUpdated: false,
        taskId: input.taskId,
      },
      { reason: input.reason, taskName: input.taskName },
    );
  }

  if (!input.result || !input.result.ok) {
    const pageId = input.result && !input.result.ok ? input.result.pageId : undefined;
    const error = input.error ?? (input.result && !input.result.ok ? input.result.error.message : undefined);

    return withOptionalFields(
      {
        ...base,
        briefGenerated: false,
        notionWriteback: false,
        outcome: "failed",
        statusUpdated: false,
        taskId: pageId ?? input.taskId,
      },
      { error: error ?? "Architect workflow failed.", taskName: input.taskName },
    );
  }

  return withOptionalFields(
    {
      ...base,
      briefGenerated: Boolean(input.result.brief),
      dryRun: input.result.dryRun,
      notionWriteback: input.result.wroteToNotion,
      outcome: "succeeded",
      statusUpdated: input.result.statusUpdated,
      taskId: input.result.pageId,
    },
    { taskName: input.taskName ?? input.result.title },
  );
}

async function recordRun(runLog: RunLog, summary: AgentOfficeRunSummary): Promise<void> {
  await runLog.record(summary);
}

export function createAgentOfficeApp(options: AgentOfficeAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const runLog = options.runLog ?? noopRunLog;
  const apiKey = requireConfiguredApiKey(options.apiKey);

  app.setErrorHandler((error, request, reply) =>
    reply.code(getHttpStatusCode(error)).send({
      error: getErrorMessage(error),
      ok: false,
      taskId: getTaskIdFromBody(request.body),
    }),
  );

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith(AGENT_OFFICE_ROUTE_PREFIX)) {
      return;
    }

    if (!isAuthorizedApiKey(request.headers[API_KEY_HEADER], apiKey)) {
      return reply.code(401).send({
        error: "Unauthorized.",
        ok: false,
      });
    }
  });

  app.get("/health", async () => ({
    ok: true,
    service: "chief-of-staff-agent-office",
    status: "healthy",
  }));

  app.get("/agent-office/tasks/ready-for-architecture", async () => {
    const tasks = await options.readyArchitectureScanner.findReadyForArchitectureTasks();

    return {
      ok: true,
      tasks,
    };
  });

  app.post("/agent-office/architect-review", async (request, reply) => {
    const parsed = ArchitectReviewRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: formatValidationError(parsed.error),
        ok: false,
        taskId: getTaskIdFromBody(request.body),
      });
    }

    const { dryRun, taskId } = parsed.data;
    const startedAt = new Date();
    const result = await options.workflow.run({
      dryRun,
      pageId: taskId,
      statusAfterWriteback: options.statusAfterWriteback,
    });
    const run = buildRunSummary({
      dryRun,
      finishedAt: new Date(),
      result,
      runId: createRunId(startedAt),
      startedAt,
      taskId,
    });
    await recordRun(runLog, run);

    if (!result.ok) {
      return reply.code(workflowErrorStatus(result.error.message)).send({
        error: result.error.message,
        ok: false,
        run,
        taskId: result.pageId ?? taskId,
      });
    }

    return reply.send({
      briefGenerated: Boolean(result.brief),
      dryRun: result.dryRun,
      ok: true,
      run,
      statusUpdated: result.statusUpdated,
      taskId: result.pageId,
    });
  });

  app.post("/agent-office/run-ready-architecture", async (request, reply) => {
    const parsed = RunReadyArchitectureRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: formatValidationError(parsed.error),
        ok: false,
      });
    }

    const { dryRun } = parsed.data;
    const tasks = await options.readyArchitectureScanner.findReadyForArchitectureTasks();
    const runs: AgentOfficeRunSummary[] = [];
    const processed: Array<{ briefGenerated: boolean; runId: string; statusUpdated: boolean; taskId: string; taskName: string }> = [];
    const skipped: Array<{ reason: string; runId: string; taskId: string; taskName: string }> = [];
    const failed: Array<{ error: string; runId: string; taskId: string; taskName: string }> = [];

    for (const task of tasks) {
      const startedAt = new Date();
      const runId = createRunId(startedAt);

      if (!dryRun) {
        try {
          const alreadyHasBrief = await options.readyArchitectureScanner.hasArchitectBrief(task.taskId);

          if (alreadyHasBrief) {
            const run = buildRunSummary({
              dryRun,
              finishedAt: new Date(),
              reason: "Architect Brief already exists on task page.",
              runId,
              startedAt,
              taskId: task.taskId,
              taskName: task.name,
            });
            await recordRun(runLog, run);
            runs.push(run);
            skipped.push({
              reason: run.reason ?? "Skipped.",
              runId: run.runId,
              taskId: run.taskId,
              taskName: task.name,
            });
            continue;
          }
        } catch (error) {
          const run = buildRunSummary({
            dryRun,
            error: getErrorMessage(error),
            finishedAt: new Date(),
            runId,
            startedAt,
            taskId: task.taskId,
            taskName: task.name,
          });
          await recordRun(runLog, run);
          runs.push(run);
          failed.push({
            error: run.error ?? "Failed.",
            runId: run.runId,
            taskId: run.taskId,
            taskName: task.name,
          });
          continue;
        }
      }

      const result = await options.workflow.run({
        dryRun,
        pageId: task.taskId,
        statusAfterWriteback: options.statusAfterWriteback,
      });
      const run = buildRunSummary({
        dryRun,
        finishedAt: new Date(),
        result,
        runId,
        startedAt,
        taskId: task.taskId,
        taskName: task.name,
      });
      await recordRun(runLog, run);
      runs.push(run);

      if (!result.ok) {
        failed.push({
          error: run.error ?? result.error.message,
          runId: run.runId,
          taskId: run.taskId,
          taskName: task.name,
        });
        continue;
      }

      processed.push({
        briefGenerated: run.briefGenerated,
        runId: run.runId,
        statusUpdated: run.statusUpdated,
        taskId: run.taskId,
        taskName: task.name,
      });
    }

    return {
      dryRun,
      failed,
      ok: failed.length === 0,
      processed,
      runs,
      skipped,
      summary: {
        failed: failed.length,
        processed: processed.length,
        skipped: skipped.length,
      },
    };
  });

  return app;
}
