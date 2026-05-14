import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import type { ArchitectTaskWorkflowInput } from "../workflows/architect-task.workflow.js";
import type { WorkflowResult } from "../workflows/workflow-result.js";

export type ArchitectReviewWorkflow = {
  run(input: ArchitectTaskWorkflowInput): Promise<WorkflowResult>;
};

export type AgentOfficeAppOptions = {
  statusAfterWriteback: string;
  workflow: ArchitectReviewWorkflow;
};

const ArchitectReviewRequestSchema = z
  .object({
    dryRun: z.boolean().default(true),
    taskId: z.string().trim().min(1, "taskId is required"),
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

  return `Invalid architect review request. ${details}`;
}

function workflowErrorStatus(errorMessage: string): number {
  return errorMessage.startsWith("Invalid Notion page ID") ? 400 : 500;
}

export function createAgentOfficeApp(options: AgentOfficeAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;

    return reply.code(statusCode).send({
      error: error.message || "Unexpected server error.",
      ok: false,
      taskId: getTaskIdFromBody(request.body),
    });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "chief-of-staff-agent-office",
    status: "healthy",
  }));

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

  return app;
}
