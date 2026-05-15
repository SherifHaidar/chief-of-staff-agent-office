import type { CodexHandoffApprovalPayload } from "../approval/codex-handoff-approval.js";
import type { GitHubDraftPrExecutionResult, GitHubDraftPrProposal } from "../domain/github-draft-pr.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";

export type GitHubDraftPrTaskRepository = {
  appendGitHubDraftPrResult(pageId: string, result: GitHubDraftPrExecutionResult, generatedAt: Date): Promise<void>;
};

export type GitHubDraftPrServiceLike = {
  createProposal(input: { now?: Date; payload: CodexHandoffApprovalPayload }): Promise<GitHubDraftPrProposal>;
  executeProposal(proposal: GitHubDraftPrProposal): Promise<GitHubDraftPrExecutionResult>;
};

export type GitHubDraftPrPreviewInput = {
  payload: CodexHandoffApprovalPayload;
};

export type ApprovedGitHubDraftPrInput = {
  proposal: GitHubDraftPrProposal;
};

export type GitHubDraftPrWorkflowSuccess = {
  dryRun: boolean;
  github?: GitHubDraftPrExecutionResult;
  ok: true;
  pageId: string;
  proposal: GitHubDraftPrProposal;
  statusUpdated: false;
  title: string;
  wroteToNotion: boolean;
};

export type GitHubDraftPrWorkflowFailure = {
  error: ReturnType<typeof serializeError>;
  ok: false;
  pageId?: string;
};

export type GitHubDraftPrWorkflowResult = GitHubDraftPrWorkflowFailure | GitHubDraftPrWorkflowSuccess;

export type GitHubDraftPrWorkflowDependencies = {
  githubDraftPrService: GitHubDraftPrServiceLike;
  logger?: Logger;
  now?: () => Date;
  taskRepository: GitHubDraftPrTaskRepository;
};

export class GitHubDraftPrWorkflow {
  private readonly githubDraftPrService: GitHubDraftPrServiceLike;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly taskRepository: GitHubDraftPrTaskRepository;

  constructor(dependencies: GitHubDraftPrWorkflowDependencies) {
    this.githubDraftPrService = dependencies.githubDraftPrService;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.taskRepository = dependencies.taskRepository;
  }

  async preview(input: GitHubDraftPrPreviewInput): Promise<GitHubDraftPrWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.payload.taskId);
      this.logger.info("Generating GitHub Draft PR proposal", { pageId });
      const proposal = await this.githubDraftPrService.createProposal({
        now: this.now(),
        payload: input.payload,
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
      this.logger.error("GitHub Draft PR proposal failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }

  async createApprovedDraftPr(input: ApprovedGitHubDraftPrInput): Promise<GitHubDraftPrWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.proposal.taskId);
      this.logger.info("Executing approved GitHub Draft PR proposal", {
        branchName: input.proposal.branchName,
        pageId,
        repository: input.proposal.repository,
      });
      const github = await this.githubDraftPrService.executeProposal(input.proposal);

      this.logger.info("Appending GitHub Draft PR result to Notion", {
        pageId,
        pullRequestUrl: github.pullRequestUrl,
      });
      await this.taskRepository.appendGitHubDraftPrResult(pageId, github, this.now());

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
      this.logger.error("Approved GitHub Draft PR execution failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
