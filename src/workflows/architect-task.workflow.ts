import type { ArchitectAgentRunner } from "../agents/architect.agent.js";
import type { ProductContextProvider } from "../context/product-context-pack.builder.js";
import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ArchitectBrief } from "../domain/architect-brief.js";
import { summarizeProductContextPack } from "../domain/product-context-pack.js";
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
  productContextProvider?: ProductContextProvider;
  taskRepository: ArchitectTaskRepository;
  targetProductRepo?: string;
};

export class ArchitectTaskWorkflow {
  private readonly architect: ArchitectAgentRunner;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly productContextProvider?: ProductContextProvider;
  private readonly taskRepository: ArchitectTaskRepository;
  private readonly targetProductRepo?: string;

  constructor(dependencies: ArchitectTaskWorkflowDependencies) {
    this.architect = dependencies.architect;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.productContextProvider = dependencies.productContextProvider;
    this.taskRepository = dependencies.taskRepository;
    this.targetProductRepo = dependencies.targetProductRepo;
  }

  async run(input: ArchitectTaskWorkflowInput): Promise<WorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.pageId);
      this.logger.info("Fetching Notion task", { pageId });
      const task = await this.taskRepository.fetchTask(pageId);
      const productContext =
        this.productContextProvider && this.targetProductRepo
          ? await this.productContextProvider.build({
              targetProductRepo: this.targetProductRepo,
              task,
            })
          : undefined;

      this.logger.info("Running Architect Agent", { pageId, title: task.title });
      const brief = await this.architect.createBrief(task, { productContext });
      const productContextSummary = summarizeProductContextPack(productContext);

      if (input.dryRun) {
        this.logger.info("Dry run complete; skipping Notion writeback", { pageId });
        return {
          brief,
          dryRun: true,
          ok: true,
          pageId,
          ...(productContextSummary ? { productContext: productContextSummary } : {}),
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
        ...(productContextSummary ? { productContext: productContextSummary } : {}),
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
