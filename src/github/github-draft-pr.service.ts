import type { CodexHandoffApprovalPayload } from "../approval/codex-handoff-approval.js";
import type { GitHubDraftPrExecutionResult, GitHubDraftPrProposal } from "../domain/github-draft-pr.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import { GitHubApiError, type GitHubAppClient } from "./github-app-client.js";
import { assertAllowedRepository, assertSafeBaseBranch, assertSafeWriteBranch, slugifyBranchPart } from "./github-policy.js";

export type GitHubDraftPrServiceConfig = {
  allowedBranchPrefixes: string[];
  allowedRepositories: string[];
  defaultBaseBranch: string;
};

export class GitHubDraftPrConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "GitHubDraftPrConflictError";
  }
}

type GitRefResponse = {
  object: {
    sha: string;
  };
};

type GitHubContentResponse = {
  commit: {
    sha: string;
  };
};

type GitHubPullRequestResponse = {
  html_url: string;
  number: number;
};

type GitHubPullRequestListResponse = Array<{
  html_url: string;
  number: number;
}>;

function parseRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split("/");

  if (!owner || !repo || repository.split("/").length !== 2) {
    throw new Error(`Invalid GitHub repository ${repository}. Expected owner/name.`);
  }

  return { owner, repo };
}

function encodePathSegment(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function notionPageUrl(taskId: string): string {
  return `https://www.notion.so/${taskId.replaceAll("-", "")}`;
}

function markdownList(items: string[]): string {
  if (items.length === 0) {
    return "- None";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/[-\s]+$/g, "");
}

function buildBranchName(payload: CodexHandoffApprovalPayload): string {
  const taskId = normalizeNotionPageId(payload.taskId);
  const slug = slugifyBranchPart(payload.handoff.suggestedPrTitle || payload.taskName || "codex-handoff");
  return `agent-office/${slug}-${taskId.slice(0, 8)}`;
}

function buildHandoffFileContent(input: {
  branchName: string;
  generatedAt: Date;
  payload: CodexHandoffApprovalPayload;
  proposalPrBody: string;
  proposalPrTitle: string;
}): string {
  const { handoff } = input.payload;
  const taskId = normalizeNotionPageId(input.payload.taskId);

  return [
    "# Agent Office Codex Handoff",
    "",
    "> Draft only. This branch and PR are prepared by the Agent Office. They are not merged, deployed, or approved for production.",
    "",
    "## Task",
    "",
    `- Notion task: ${input.payload.taskName ?? "Untitled task"}`,
    `- Notion task ID: ${taskId}`,
    `- Notion link: ${notionPageUrl(taskId)}`,
    `- Generated at: ${input.generatedAt.toISOString()}`,
    `- Target repository: ${handoff.targetProductRepo}`,
    `- Branch: ${input.branchName}`,
    "",
    "## Problem Summary",
    "",
    handoff.problemSummary,
    "",
    "## Product Intent",
    "",
    handoff.productIntent,
    "",
    "## Implementation Scope",
    "",
    markdownList(handoff.implementationScope),
    "",
    "## Likely Affected Files or Modules",
    "",
    markdownList(handoff.likelyAffectedFiles),
    "",
    "## Constraints / Do Not Change",
    "",
    markdownList(handoff.constraints),
    "",
    "## Implementation Steps",
    "",
    markdownList(handoff.implementationSteps),
    "",
    "## Tests To Run",
    "",
    markdownList(handoff.testsToRun),
    "",
    "## Acceptance Checklist",
    "",
    markdownList(handoff.acceptanceChecklist),
    "",
    "## Suggested PR Title",
    "",
    handoff.suggestedPrTitle,
    "",
    "## Suggested PR Body",
    "",
    handoff.suggestedPrBody,
    "",
    "## Draft PR Prepared By Agent Office",
    "",
    `- PR title: ${input.proposalPrTitle}`,
    "- PR body:",
    "",
    input.proposalPrBody,
    "",
    "## Explicit Merge / Deploy Approval Warnings",
    "",
    markdownList(handoff.explicitApprovalWarnings),
    "",
    "## Human Approval Boundary",
    "",
    "- Sherif must review implementation work before merge.",
    "- Sherif must approve deployment separately.",
    "- The Agent Office must not push to main, merge, deploy, or change repository settings/secrets.",
    "",
  ].join("\n");
}

function buildPrBody(payload: CodexHandoffApprovalPayload, branchName: string): string {
  const { handoff } = payload;
  const taskId = normalizeNotionPageId(payload.taskId);

  return [
    "## Agent Office Draft PR",
    "",
    "This is a draft preparation PR created by the Agent Office. It does not contain product code changes yet.",
    "",
    "## Source Task",
    "",
    `- Notion task: ${payload.taskName ?? "Untitled task"}`,
    `- Notion task ID: ${taskId}`,
    `- Notion link: ${notionPageUrl(taskId)}`,
    `- Branch: ${branchName}`,
    "",
    "## Problem Summary",
    "",
    handoff.problemSummary,
    "",
    "## Implementation Scope",
    "",
    markdownList(handoff.implementationScope),
    "",
    "## Tests To Run",
    "",
    markdownList(handoff.testsToRun),
    "",
    "## Acceptance Checklist",
    "",
    markdownList(handoff.acceptanceChecklist),
    "",
    "## Approval Boundary",
    "",
    "- Draft only: not merged, not deployed, not approved for production.",
    "- Merge requires Sherif approval.",
    "- Deployment requires separate Sherif approval.",
  ].join("\n");
}

export class GitHubDraftPrService {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: GitHubDraftPrServiceConfig,
  ) {}

  async createProposal(input: { now?: Date; payload: CodexHandoffApprovalPayload }): Promise<GitHubDraftPrProposal> {
    const repository = input.payload.handoff.targetProductRepo;
    const taskId = normalizeNotionPageId(input.payload.taskId);
    const baseBranch = this.config.defaultBaseBranch;
    const branchName = buildBranchName(input.payload);

    this.assertPolicy({ baseBranch, branchName, repository });
    await this.assertNoDuplicateBranchOrPr(repository, branchName);

    const baseCommitSha = await this.getBranchSha(repository, baseBranch);
    const prTitle = truncate(`[Draft] ${input.payload.handoff.suggestedPrTitle}`, 240);
    const prBody = buildPrBody(input.payload, branchName);
    const handoffFilePath = `.agent-office/handoffs/${taskId}.md`;
    const handoffFileContent = buildHandoffFileContent({
      branchName,
      generatedAt: input.now ?? new Date(),
      payload: input.payload,
      proposalPrBody: prBody,
      proposalPrTitle: prTitle,
    });

    return {
      baseBranch,
      baseCommitSha,
      branchName,
      commitMessage: `Add Agent Office handoff for ${input.payload.handoff.suggestedPrTitle}`,
      draft: true,
      handoffFileContent,
      handoffFilePath,
      prBody,
      prTitle,
      repository,
      taskId,
      ...(input.payload.taskName ? { taskName: input.payload.taskName } : {}),
    };
  }

  async executeProposal(proposal: GitHubDraftPrProposal): Promise<GitHubDraftPrExecutionResult> {
    this.assertPolicy({
      baseBranch: proposal.baseBranch,
      branchName: proposal.branchName,
      repository: proposal.repository,
    });
    await this.assertNoDuplicateBranchOrPr(proposal.repository, proposal.branchName);

    await this.createBranch(proposal.repository, proposal.branchName, proposal.baseCommitSha);
    const commitSha = await this.putHandoffFile(proposal);
    const pullRequest = await this.openDraftPullRequest(proposal);

    return {
      baseBranch: proposal.baseBranch,
      baseCommitSha: proposal.baseCommitSha,
      branchName: proposal.branchName,
      commitSha,
      draft: true,
      handoffFilePath: proposal.handoffFilePath,
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.html_url,
      repository: proposal.repository,
    };
  }

  private assertPolicy(input: { baseBranch: string; branchName: string; repository: string }): void {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    assertSafeBaseBranch(input.baseBranch);
    assertSafeWriteBranch(input.branchName, this.config.allowedBranchPrefixes);
  }

  private async assertNoDuplicateBranchOrPr(repository: string, branchName: string): Promise<void> {
    const branchExists = await this.branchExists(repository, branchName);
    if (branchExists) {
      throw new GitHubDraftPrConflictError(`Branch ${branchName} already exists in ${repository}.`);
    }

    const openPr = await this.findOpenPullRequestByHead(repository, branchName);
    if (openPr) {
      throw new GitHubDraftPrConflictError(
        `Open draft PR #${openPr.number} already exists for branch ${branchName}: ${openPr.html_url}`,
      );
    }
  }

  private async getBranchSha(repository: string, branchName: string): Promise<string> {
    const { owner, repo } = parseRepository(repository);
    const response = await this.client.request<GitRefResponse>({
      path: `/repos/${owner}/${repo}/git/ref/heads/${encodePathSegment(branchName)}`,
    });

    return response.object.sha;
  }

  private async branchExists(repository: string, branchName: string): Promise<boolean> {
    try {
      await this.getBranchSha(repository, branchName);
      return true;
    } catch (error) {
      if (error instanceof GitHubApiError && error.statusCode === 404) {
        return false;
      }

      throw error;
    }
  }

  private async findOpenPullRequestByHead(
    repository: string,
    branchName: string,
  ): Promise<GitHubPullRequestListResponse[number] | undefined> {
    const { owner, repo } = parseRepository(repository);
    const response = await this.client.request<GitHubPullRequestListResponse>({
      path: `/repos/${owner}/${repo}/pulls`,
      query: {
        head: `${owner}:${branchName}`,
        state: "open",
      },
    });

    return response[0];
  }

  private async createBranch(repository: string, branchName: string, sha: string): Promise<void> {
    const { owner, repo } = parseRepository(repository);
    await this.client.request<unknown>({
      body: {
        ref: `refs/heads/${branchName}`,
        sha,
      },
      method: "POST",
      path: `/repos/${owner}/${repo}/git/refs`,
    });
  }

  private async putHandoffFile(proposal: GitHubDraftPrProposal): Promise<string> {
    const { owner, repo } = parseRepository(proposal.repository);
    const response = await this.client.request<GitHubContentResponse>({
      body: {
        branch: proposal.branchName,
        content: Buffer.from(proposal.handoffFileContent, "utf8").toString("base64"),
        message: proposal.commitMessage,
      },
      method: "PUT",
      path: `/repos/${owner}/${repo}/contents/${encodePathSegment(proposal.handoffFilePath)}`,
    });

    return response.commit.sha;
  }

  private async openDraftPullRequest(proposal: GitHubDraftPrProposal): Promise<GitHubPullRequestResponse> {
    const { owner, repo } = parseRepository(proposal.repository);
    return this.client.request<GitHubPullRequestResponse>({
      body: {
        base: proposal.baseBranch,
        body: proposal.prBody,
        draft: true,
        head: proposal.branchName,
        title: proposal.prTitle,
      },
      method: "POST",
      path: `/repos/${owner}/${repo}/pulls`,
    });
  }
}
