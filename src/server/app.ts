import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import type { ReadyArchitectureTask } from "../domain/ready-architecture-task.js";
import type { ArchitectTaskWorkflowInput } from "../workflows/architect-task.workflow.js";
import type { WorkflowResult } from "../workflows/workflow-result.js";

export type ArchitectReviewWorkflow = {
  run(input: ArchitectTaskWorkflowInput): Promise<WorkflowResult>;
};

export type ReadyArchitectureTaskScanner = {
  findReadyForArchitectureTasks(): Promise<ReadyArchitectureTask[]>;
  hasArchitectBrief(taskId: string): Promise<boolean>;
};

export type AgentOfficeAppOptions = {
  readyArchitectureScanner: ReadyArchitectureTaskScanner;
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

export function createAgentOfficeApp(options: AgentOfficeAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, request, reply) =>
    reply.code(getHttpStatusCode(error)).send({
      error: getErrorMessage(error),
      ok: false,
      taskId: getTaskIdFromBody(request.body),
    }),
  );

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
    const result = await options.workflow.run({
      dryRun,
      pageId: taskId,
      statusAfterWriteback: options.statusAfterWriteback,
    });

    if (!result.ok) {
      return reply.code(workflowErrorStatus(result.error.message)).send({
        error: result.error.message,
        ok: false,
        taskId: result.pageId ?? taskId,
      });
    }

    return reply.send({
      briefGenerated: Boolean(result.brief),
      dryRun: result.dryRun,
      ok: true,
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
    const processed: Array<{ briefGenerated: boolean; statusUpdated: boolean; taskId: string; taskName: string }> = [];
    const skipped: Array<{ reason: string; taskId: string; taskName: string }> = [];
    const failed: Array<{ error: string; taskId: string; taskName: string }> = [];

    for (const task of tasks) {
      if (!dryRun) {
        try {
          const alreadyHasBrief = await options.readyArchitectureScanner.hasArchitectBrief(task.taskId);

          if (alreadyHasBrief) {
            skipped.push({
              reason: "Architect Brief already exists on task page.",
              taskId: task.taskId,
              taskName: task.name,
            });
            continue;
          }
        } catch (error) {
          failed.push({
            error: getErrorMessage(error),
            taskId: task.taskId,
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

      if (!result.ok) {
        failed.push({
          error: result.error.message,
          taskId: result.pageId ?? task.taskId,
          taskName: task.name,
        });
        continue;
      }

      processed.push({
        briefGenerated: Boolean(result.brief),
        statusUpdated: result.statusUpdated,
        taskId: result.pageId,
        taskName: task.name,
      });
    }

    return {
      dryRun,
      failed,
      ok: failed.length === 0,
      processed,
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
