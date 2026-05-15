import type { ArchitectAgentRunner } from "../agents/architect.agent.js";
import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ArchitectBrief } from "../domain/architect-brief.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";
import type { WorkflowResult } from "./workflow-result.js";

export type ArchitectTaskRepository = {
  appendArchitectBrief(pageId: string, brief: ArchitectBrief, generatedAt: Date): Promise<void>;
  fetchTask(pageId: string): Promise<AiBuildTask>;
  markArchitectBriefReady(pageId: string, statusName: string): Promise<void>;
};

export type ArchitectTaskWorkflowInput = {
  dryRun?: boolean;
  pageId: string;
  statusAfterWriteback: string;
};

export type ApprovedArchitectBriefWritebackInput = {
  brief: ArchitectBrief;
  pageId: string;
  statusAfterWriteback: string;
  taskName?: string;
};

export type ArchitectTaskWorkflowDependencies = {
  architect: ArchitectAgentRunner;
  logger?: Logger;
  now?: () => Date;
  taskRepository: ArchitectTaskRepository;
};

export class ArchitectTaskWorkflow {
  private readonly architect: ArchitectAgentRunner;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly taskRepository: ArchitectTaskRepository;

  constructor(dependencies: ArchitectTaskWorkflowDependencies) {
    this.architect = dependencies.architect;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.taskRepository = dependencies.taskRepository;
  }

  async run(input: ArchitectTaskWorkflowInput): Promise<WorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.pageId);
      this.logger.info("Fetching Notion task", { pageId });
      const task = await this.taskRepository.fetchTask(pageId);

      this.logger.info("Running Architect Agent", { pageId, title: task.title });
      const brief = await this.architect.createBrief(task);

      if (input.dryRun) {
        this.logger.info("Dry run complete; skipping Notion writeback", { pageId });
        return {
          brief,
          dryRun: true,
          ok: true,
          pageId,
          statusUpdated: false,
          title: task.title,
          wroteToNotion: false,
        };
      }

      this.logger.info("Appending Architect Brief to Notion", { pageId });
      await this.taskRepository.appendArchitectBrief(pageId, brief, this.now());

      this.logger.info("Updating Notion task status", {
        pageId,
        status: input.statusAfterWriteback,
      });
      await this.taskRepository.markArchitectBriefReady(pageId, input.statusAfterWriteback);

      return {
        brief,
        dryRun: false,
        ok: true,
        pageId,
        statusUpdated: true,
        title: task.title,
        wroteToNotion: true,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Architect task workflow failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }

  async writeApprovedBrief(input: ApprovedArchitectBriefWritebackInput): Promise<WorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.pageId);
      this.logger.info("Appending approved Architect Brief to Notion", { pageId });
      await this.taskRepository.appendArchitectBrief(pageId, input.brief, this.now());

      this.logger.info("Updating Notion task status after approved writeback", {
        pageId,
        status: input.statusAfterWriteback,
      });
      await this.taskRepository.markArchitectBriefReady(pageId, input.statusAfterWriteback);

      return {
        brief: input.brief,
        dryRun: false,
        ok: true,
        pageId,
        statusUpdated: true,
        title: input.taskName ?? "Approved Architect Brief",
        wroteToNotion: true,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Approved Architect Brief writeback failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
