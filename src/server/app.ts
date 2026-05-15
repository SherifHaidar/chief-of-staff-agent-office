import { createHash, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import {
  ArchitectBriefApprovalTokenError,
  createArchitectBriefApproval,
  verifyArchitectBriefApproval,
} from "../approval/architect-brief-approval.js";
import {
  CodexHandoffApprovalTokenError,
  createCodexHandoffApproval,
  verifyCodexHandoffApproval,
} from "../approval/codex-handoff-approval.js";
import type { RunLog } from "../audit/run-log.js";
import { noopRunLog } from "../audit/run-log.js";
import type { AgentOfficeRunSummary } from "../audit/run-summary.js";
import { createRunId } from "../audit/run-summary.js";
import type { ReadyArchitectureTask } from "../domain/ready-architecture-task.js";
import type {
  ApprovedArchitectBriefWritebackInput,
  ArchitectTaskWorkflowInput,
} from "../workflows/architect-task.workflow.js";
import type {
  ApprovedCodexHandoffWritebackInput,
  CodexHandoffWorkflowInput,
  CodexHandoffWorkflowResult,
} from "../workflows/codex-handoff.workflow.js";
import type { WorkflowResult } from "../workflows/workflow-result.js";
import { renderOperatorConsolePage } from "./operator-console-page.js";

const API_KEY_HEADER = "x-agent-office-api-key";
const AGENT_OFFICE_ROUTE_PREFIX = "/agent-office/";

export type ArchitectReviewWorkflow = {
  run(input: ArchitectTaskWorkflowInput): Promise<WorkflowResult>;
};

export type ApprovedArchitectBriefWriter = {
  writeApprovedBrief(input: ApprovedArchitectBriefWritebackInput): Promise<WorkflowResult>;
};

export type ReadyArchitectureTaskScanner = {
  findReadyForArchitectureTasks(): Promise<ReadyArchitectureTask[]>;
  hasArchitectBrief(taskId: string): Promise<boolean>;
};

export type CodexHandoffWorkflowRunner = {
  run(input: CodexHandoffWorkflowInput): Promise<CodexHandoffWorkflowResult>;
};

export type ApprovedCodexHandoffWriter = {
  writeApprovedHandoff(input: ApprovedCodexHandoffWritebackInput): Promise<CodexHandoffWorkflowResult>;
};

export type ReadyCodexTaskScanner = {
  findReadyForCodexTasks(): Promise<ReadyArchitectureTask[]>;
  hasCodexHandoffBrief(taskId: string): Promise<boolean>;
};

export type AgentOfficeAppOptions = {
  apiKey: string;
  approvalSecret: string;
  approvedBriefWriter: ApprovedArchitectBriefWriter;
  approvedCodexHandoffWriter?: ApprovedCodexHandoffWriter;
  codexHandoffWorkflow?: CodexHandoffWorkflowRunner;
  readyArchitectureScanner: ReadyArchitectureTaskScanner;
  readyCodexScanner?: ReadyCodexTaskScanner;
  runLog?: RunLog;
  statusAfterCodexHandoff?: string;
  statusAfterWriteback: string;
  targetProductRepo?: string;
  workflow: ArchitectReviewWorkflow;
};

type AnyWorkflowResult = CodexHandoffWorkflowResult | WorkflowResult;

const ArchitectReviewRequestSchema = z
  .object({
    dryRun: z.boolean().default(true),
    taskId: z.string().trim().min(1, "taskId is required"),
  })
  .strict();

const ArchitectReviewApprovalRequestSchema = z
  .object({
    approvalToken: z.string().trim().min(1, "approvalToken is required"),
  })
  .strict();

const CodexHandoffRequestSchema = z
  .object({
    taskId: z.string().trim().min(1, "taskId is required"),
  })
  .strict();

const CodexHandoffApprovalRequestSchema = z
  .object({
    approvalToken: z.string().trim().min(1, "approvalToken is required"),
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

function requireConfiguredSecret(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be configured.`);
  }

  return value;
}

function requireConfiguredFeature<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
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

function resultHasBrief(result: AnyWorkflowResult): boolean {
  if (!result.ok) {
    return false;
  }

  return "brief" in result ? Boolean(result.brief) : Boolean(result.handoff);
}

function buildRunSummary(input: {
  dryRun: boolean;
  error?: string;
  finishedAt: Date;
  reason?: string;
  result?: AnyWorkflowResult;
  runId: string;
  startedAt: Date;
  taskId: string;
  taskName?: string;
  workflow?: AgentOfficeRunSummary["workflow"];
}): AgentOfficeRunSummary {
  const base = {
    dryRun: input.dryRun,
    finishedAt: input.finishedAt.toISOString(),
    runId: input.runId,
    startedAt: input.startedAt.toISOString(),
    workflow: input.workflow ?? "architect-review",
  } satisfies Pick<AgentOfficeRunSummary, "dryRun" | "finishedAt" | "runId" | "startedAt" | "workflow">;

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
      { error: error ?? "Agent Office workflow failed.", taskName: input.taskName },
    );
  }

  return withOptionalFields(
    {
      ...base,
      briefGenerated: resultHasBrief(input.result),
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
  const apiKey = requireConfiguredSecret(options.apiKey, "Agent Office API key");
  const approvalSecret = requireConfiguredSecret(options.approvalSecret, "Agent Office approval secret");

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

  app.get("/office", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderOperatorConsolePage()));

  app.get("/agent-office/tasks/ready-for-architecture", async () => {
    const tasks = await options.readyArchitectureScanner.findReadyForArchitectureTasks();

    return {
      ok: true,
      tasks,
    };
  });

  app.get("/agent-office/tasks/ready-for-codex", async () => {
    const scanner = requireConfiguredFeature(options.readyCodexScanner, "Ready for Codex scanner");
    const tasks = await scanner.findReadyForCodexTasks();

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

    const approval = result.dryRun
      ? createArchitectBriefApproval({
          brief: result.brief,
          previewRunId: run.runId,
          secret: approvalSecret,
          statusAfterWriteback: options.statusAfterWriteback,
          taskId: result.pageId,
          taskName: result.title,
        })
      : undefined;

    return reply.send({
      ...(result.dryRun ? { approval, brief: result.brief } : {}),
      briefGenerated: Boolean(result.brief),
      dryRun: result.dryRun,
      ok: true,
      run,
      statusUpdated: result.statusUpdated,
      taskId: result.pageId,
    });
  });

  app.post("/agent-office/architect-review/approve", async (request, reply) => {
    const parsed = ArchitectReviewApprovalRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: formatValidationError(parsed.error),
        ok: false,
      });
    }

    let approval;
    try {
      approval = verifyArchitectBriefApproval({
        secret: approvalSecret,
        token: parsed.data.approvalToken,
      });
    } catch (error) {
      if (error instanceof ArchitectBriefApprovalTokenError) {
        return reply.code(401).send({
          error: error.message,
          ok: false,
        });
      }

      throw error;
    }

    const startedAt = new Date();
    const runId = createRunId(startedAt);

    try {
      const alreadyHasBrief = await options.readyArchitectureScanner.hasArchitectBrief(approval.taskId);
      if (alreadyHasBrief) {
        const run = buildRunSummary({
          dryRun: false,
          finishedAt: new Date(),
          reason: "Architect Brief already exists on task page.",
          runId,
          startedAt,
          taskId: approval.taskId,
          taskName: approval.taskName,
        });
        await recordRun(runLog, run);

        return reply.code(409).send({
          error: run.reason,
          ok: false,
          run,
          taskId: approval.taskId,
        });
      }
    } catch (error) {
      const run = buildRunSummary({
        dryRun: false,
        error: getErrorMessage(error),
        finishedAt: new Date(),
        runId,
        startedAt,
        taskId: approval.taskId,
        taskName: approval.taskName,
      });
      await recordRun(runLog, run);

      return reply.code(500).send({
        error: run.error,
        ok: false,
        run,
        taskId: approval.taskId,
      });
    }

    const result = await options.approvedBriefWriter.writeApprovedBrief({
      brief: approval.brief,
      pageId: approval.taskId,
      statusAfterWriteback: approval.statusAfterWriteback,
      ...(approval.taskName ? { taskName: approval.taskName } : {}),
    });
    const run = buildRunSummary({
      dryRun: false,
      finishedAt: new Date(),
      result,
      runId,
      startedAt,
      taskId: approval.taskId,
      taskName: approval.taskName,
    });
    await recordRun(runLog, run);

    if (!result.ok) {
      return reply.code(workflowErrorStatus(result.error.message)).send({
        error: result.error.message,
        ok: false,
        run,
        taskId: result.pageId ?? approval.taskId,
      });
    }

    return reply.send({
      approval: {
        briefHash: approval.briefHash,
        expiresAt: approval.expiresAt,
        previewRunId: approval.previewRunId,
      },
      briefGenerated: true,
      dryRun: false,
      ok: true,
      run,
      statusUpdated: result.statusUpdated,
      taskId: result.pageId,
    });
  });

  app.post("/agent-office/codex-handoff", async (request, reply) => {
    const parsed = CodexHandoffRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: formatValidationError(parsed.error),
        ok: false,
        taskId: getTaskIdFromBody(request.body),
      });
    }

    const workflow = requireConfiguredFeature(options.codexHandoffWorkflow, "Codex Handoff workflow");
    const targetProductRepo = requireConfiguredFeature(options.targetProductRepo, "Target product repository");
    const { taskId } = parsed.data;
    const startedAt = new Date();
    const result = await workflow.run({
      dryRun: true,
      pageId: taskId,
      statusAfterWriteback: options.statusAfterCodexHandoff,
      targetProductRepo,
    });
    const run = buildRunSummary({
      dryRun: true,
      finishedAt: new Date(),
      result,
      runId: createRunId(startedAt),
      startedAt,
      taskId,
      workflow: "codex-handoff",
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

    const approval = createCodexHandoffApproval({
      handoff: result.handoff,
      previewRunId: run.runId,
      secret: approvalSecret,
      statusAfterWriteback: options.statusAfterCodexHandoff,
      targetProductRepo,
      taskId: result.pageId,
      taskName: result.title,
    });

    return reply.send({
      approval,
      dryRun: true,
      handoff: result.handoff,
      handoffGenerated: true,
      ok: true,
      run,
      statusUpdated: false,
      taskId: result.pageId,
    });
  });

  app.post("/agent-office/codex-handoff/approve", async (request, reply) => {
    const parsed = CodexHandoffApprovalRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: formatValidationError(parsed.error),
        ok: false,
      });
    }

    let approval;
    try {
      approval = verifyCodexHandoffApproval({
        secret: approvalSecret,
        token: parsed.data.approvalToken,
      });
    } catch (error) {
      if (error instanceof CodexHandoffApprovalTokenError) {
        return reply.code(401).send({
          error: error.message,
          ok: false,
        });
      }

      throw error;
    }

    const scanner = requireConfiguredFeature(options.readyCodexScanner, "Ready for Codex scanner");
    const writer = requireConfiguredFeature(options.approvedCodexHandoffWriter, "Approved Codex Handoff writer");
    const startedAt = new Date();
    const runId = createRunId(startedAt);

    try {
      const alreadyHasBrief = await scanner.hasCodexHandoffBrief(approval.taskId);
      if (alreadyHasBrief) {
        const run = buildRunSummary({
          dryRun: false,
          finishedAt: new Date(),
          reason: "Codex Handoff Brief already exists on task page.",
          runId,
          startedAt,
          taskId: approval.taskId,
          taskName: approval.taskName,
          workflow: "codex-handoff",
        });
        await recordRun(runLog, run);

        return reply.code(409).send({
          error: run.reason,
          ok: false,
          run,
          taskId: approval.taskId,
        });
      }
    } catch (error) {
      const run = buildRunSummary({
        dryRun: false,
        error: getErrorMessage(error),
        finishedAt: new Date(),
        runId,
        startedAt,
        taskId: approval.taskId,
        taskName: approval.taskName,
        workflow: "codex-handoff",
      });
      await recordRun(runLog, run);

      return reply.code(500).send({
        error: run.error,
        ok: false,
        run,
        taskId: approval.taskId,
      });
    }

    const result = await writer.writeApprovedHandoff({
      handoff: approval.handoff,
      pageId: approval.taskId,
      statusAfterWriteback: approval.statusAfterWriteback,
      targetProductRepo: approval.targetProductRepo,
      ...(approval.taskName ? { taskName: approval.taskName } : {}),
    });
    const run = buildRunSummary({
      dryRun: false,
      finishedAt: new Date(),
      result,
      runId,
      startedAt,
      taskId: approval.taskId,
      taskName: approval.taskName,
      workflow: "codex-handoff",
    });
    await recordRun(runLog, run);

    if (!result.ok) {
      return reply.code(workflowErrorStatus(result.error.message)).send({
        error: result.error.message,
        ok: false,
        run,
        taskId: result.pageId ?? approval.taskId,
      });
    }

    return reply.send({
      approval: {
        expiresAt: approval.expiresAt,
        handoffHash: approval.handoffHash,
        previewRunId: approval.previewRunId,
      },
      dryRun: false,
      handoffGenerated: true,
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
