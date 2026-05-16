import type { CodexHandoffApprovalPayload } from "../approval/codex-handoff-approval.js";
import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ImplementationExecutionResult, ImplementationProposal } from "../domain/implementation-proposal.js";
import type { ProductContextProvider } from "../context/product-context-pack.builder.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";
import type { ImplementationAgentRunner } from "../agents/implementation.agent.js";
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
  implementationAgent: ImplementationAgentRunner;
  implementationService: ImplementationService;
  logger?: Logger;
  now?: () => Date;
  productContextProvider?: ProductContextProvider;
  taskRepository: ImplementationTaskRepository;
};

export class ImplementationWorkflow {
  private readonly implementationAgent: ImplementationAgentRunner;
  private readonly implementationService: ImplementationService;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly productContextProvider?: ProductContextProvider;
  private readonly taskRepository: ImplementationTaskRepository;

  constructor(dependencies: ImplementationWorkflowDependencies) {
    this.implementationAgent = dependencies.implementationAgent;
    this.implementationService = dependencies.implementationService;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.productContextProvider = dependencies.productContextProvider;
    this.taskRepository = dependencies.taskRepository;
  }

  async preview(input: ImplementationPreviewInput): Promise<ImplementationWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.payload.taskId);
      this.logger.info("Generating controlled implementation proposal", { pageId });
      const task = await this.taskRepository.fetchTask(pageId);
      const productContext = await this.productContextProvider?.build({
        targetProductRepo: input.payload.targetProductRepo,
        task,
      });
      const shell = await this.implementationService.createProposalShell(input.payload);
      const limits = this.implementationService.limits();
      const draftProposal = await this.implementationAgent.createProposal(task, {
        baseBranch: shell.baseBranch,
        baseCommitSha: shell.baseCommitSha,
        branchName: shell.branchName,
        codexHandoff: input.payload,
        maxChangedFiles: limits.maxChangedFiles,
        maxTotalChangeChars: limits.maxTotalChangeChars,
        productContext,
        targetProductRepo: input.payload.targetProductRepo,
      });
      const proposal = this.implementationService.finalizeProposal({
        payload: input.payload,
        productContext,
        proposal: draftProposal,
        shell,
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
      this.logger.error("Controlled implementation proposal failed", { error: serialized.message, pageId });

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
      this.logger.info("Executing approved controlled implementation proposal", {
        branchName: input.proposal.branchName,
        pageId,
        repository: input.proposal.repository,
      });
      const github = await this.implementationService.executeProposal(input.proposal);

      this.logger.info("Appending controlled implementation result to Notion", {
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
      this.logger.error("Approved controlled implementation execution failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
