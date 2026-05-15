import type { CodexHandoffAgentRunner } from "../agents/codex-handoff.agent.js";
import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { CodexHandoffBrief } from "../domain/codex-handoff-brief.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";

export type CodexHandoffTaskRepository = {
  appendCodexHandoffBrief(pageId: string, brief: CodexHandoffBrief, generatedAt: Date): Promise<void>;
  fetchTask(pageId: string): Promise<AiBuildTask>;
  markCodexHandoffReady(pageId: string, statusName: string): Promise<void>;
};

export type CodexHandoffWorkflowInput = {
  dryRun?: boolean;
  pageId: string;
  statusAfterWriteback?: string;
  targetProductRepo: string;
};

export type ApprovedCodexHandoffWritebackInput = {
  handoff: CodexHandoffBrief;
  pageId: string;
  statusAfterWriteback?: string;
  targetProductRepo: string;
  taskName?: string;
};

export type CodexHandoffWorkflowSuccess = {
  dryRun: boolean;
  handoff: CodexHandoffBrief;
  ok: true;
  pageId: string;
  statusUpdated: boolean;
  targetProductRepo: string;
  title: string;
  wroteToNotion: boolean;
};

export type CodexHandoffWorkflowFailure = {
  error: ReturnType<typeof serializeError>;
  ok: false;
  pageId?: string;
};

export type CodexHandoffWorkflowResult = CodexHandoffWorkflowFailure | CodexHandoffWorkflowSuccess;

export type CodexHandoffWorkflowDependencies = {
  codexHandoff: CodexHandoffAgentRunner;
  logger?: Logger;
  now?: () => Date;
  taskRepository: CodexHandoffTaskRepository;
};

export class CodexHandoffWorkflow {
  private readonly codexHandoff: CodexHandoffAgentRunner;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly taskRepository: CodexHandoffTaskRepository;

  constructor(dependencies: CodexHandoffWorkflowDependencies) {
    this.codexHandoff = dependencies.codexHandoff;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.taskRepository = dependencies.taskRepository;
  }

  async run(input: CodexHandoffWorkflowInput): Promise<CodexHandoffWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.pageId);
      this.logger.info("Fetching Notion task for Codex handoff", { pageId });
      const task = await this.taskRepository.fetchTask(pageId);

      this.logger.info("Running Codex Handoff Agent", {
        pageId,
        targetProductRepo: input.targetProductRepo,
        title: task.title,
      });
      const handoff = await this.codexHandoff.createHandoff(task, {
        targetProductRepo: input.targetProductRepo,
      });

      if (input.dryRun ?? true) {
        this.logger.info("Codex handoff preview complete; skipping Notion writeback", { pageId });
        return {
          dryRun: true,
          handoff,
          ok: true,
          pageId,
          statusUpdated: false,
          targetProductRepo: input.targetProductRepo,
          title: task.title,
          wroteToNotion: false,
        };
      }

      return this.writeApprovedHandoff({
        handoff,
        pageId,
        statusAfterWriteback: input.statusAfterWriteback,
        targetProductRepo: input.targetProductRepo,
        taskName: task.title,
      });
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Codex Handoff workflow failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }

  async writeApprovedHandoff(input: ApprovedCodexHandoffWritebackInput): Promise<CodexHandoffWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.pageId);
      this.logger.info("Appending approved Codex Handoff Brief to Notion", { pageId });
      await this.taskRepository.appendCodexHandoffBrief(pageId, input.handoff, this.now());

      let statusUpdated = false;
      if (input.statusAfterWriteback) {
        this.logger.info("Updating Notion task status after Codex handoff writeback", {
          pageId,
          status: input.statusAfterWriteback,
        });
        await this.taskRepository.markCodexHandoffReady(pageId, input.statusAfterWriteback);
        statusUpdated = true;
      }

      return {
        dryRun: false,
        handoff: input.handoff,
        ok: true,
        pageId,
        statusUpdated,
        targetProductRepo: input.targetProductRepo,
        title: input.taskName ?? "Approved Codex Handoff Brief",
        wroteToNotion: true,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Approved Codex Handoff Brief writeback failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
