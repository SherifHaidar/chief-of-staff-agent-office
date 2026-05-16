import type { CodexHandoffApprovalPayload } from "../approval/codex-handoff-approval.js";
import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../domain/implementation-proposal.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";
import type { ImplementationService } from "../github/implementation.service.js";

export type ImplementationTaskRepository = {
  appendImplementationResult(pageId: string, result: ImplementationExecutionResult, proposal: ImplementationProposal, generatedAt: Date): Promise<void>;
  fetchTask(pageId: string): Promise<AiBuildTask>;
};

export type ImplementationPreviewInput = {
  payload: CodexHandoffApprovalPayload;
};

export type ApprovedImplementationInput = {
  proposal: ImplementationProposal;
};

export type ImplementationWorkflowSuccess = {
  dryRun: boolean;
  github?: ImplementationExecutionResult;
  ok: true;
  pageId: string;
  proposal: ImplementationProposal;
  statusUpdated: false;
  title: string;
  wroteToNotion: boolean;
};

export type ImplementationWorkflowFailure = {
  error: ReturnType<typeof serializeError>;
  ok: false;
  pageId?: string;
};

export type ImplementationWorkflowResult = ImplementationWorkflowFailure | ImplementationWorkflowSuccess;

export type ImplementationWorkflowDependencies = {
  implementationService: ImplementationService;
  logger?: Logger;
  now?: () => Date;
  taskRepository: ImplementationTaskRepository;
};

export class ImplementationWorkflow {
  private readonly implementationService: ImplementationService;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly taskRepository: ImplementationTaskRepository;

  constructor(dependencies: ImplementationWorkflowDependencies) {
    this.implementationService = dependencies.implementationService;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.taskRepository = dependencies.taskRepository;
  }

  async preview(input: ImplementationPreviewInput): Promise<ImplementationWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.payload.taskId);
      this.logger.info("Creating deterministic implementation work order preview", { pageId });
      const task = await this.taskRepository.fetchTask(pageId);
      const proposal = await this.implementationService.createWorkOrderProposal({
        payload: input.payload,
        task,
      });

      return {
        dryRun: true,
        ok: true,
        pageId,
        proposal,
        statusUpdated: false,
        title: proposal.prTitle,
        wroteToNotion: false,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Controlled implementation work order preview failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }

  async createApprovedImplementation(input: ApprovedImplementationInput): Promise<ImplementationWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.proposal.taskId);
      this.logger.info("Creating approved implementation work-order PR", {
        branchName: input.proposal.branchName,
        pageId,
        repository: input.proposal.repository,
        workOrderPath: input.proposal.workOrderPath,
      });
      const github = await this.implementationService.executeProposal(input.proposal);

      this.logger.info("Appending implementation work-order PR result to Notion", {
        pageId,
        pullRequestUrl: github.pullRequestUrl,
      });
      await this.taskRepository.appendImplementationResult(pageId, github, input.proposal, this.now());

      return {
        dryRun: false,
        github,
        ok: true,
        pageId,
        proposal: input.proposal,
        statusUpdated: false,
        title: input.proposal.prTitle,
        wroteToNotion: true,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Approved implementation work-order PR creation failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
