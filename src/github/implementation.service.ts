import type { CodexHandoffApprovalPayload } from "../approval/codex-handoff-approval.js";
import type { AiBuildTask } from "../domain/ai-build-task.js";
import type {
  GitHubCheckSummary,
  ImplementationHandoffSummary,
  ImplementationExecutionResult,
  ImplementationProposal,
} from "../domain/implementation-proposal.js";
import { IMPLEMENTATION_NEXT_ACTION, IMPLEMENTATION_PENDING_NOTICE } from "../domain/implementation-proposal.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import { GitHubApiError, type GitHubAppClient } from "./github-app-client.js";
import { assertAllowedRepository, assertSafeBaseBranch, assertSafeWriteBranch, slugifyBranchPart } from "./github-policy.js";

export type ImplementationServiceConfig = {
  allowedBranchPrefixes: string[];
  allowedRepositories: string[];
  defaultBaseBranch: string;
  maxChangedFiles: number;
  maxFileChars: number;
  maxTotalChangeChars: number;
};

export class ImplementationProposalPolicyError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "ImplementationProposalPolicyError";
  }
}

type GitRefResponse = {
  object: {
    sha: string;
  };
};

type GitCommitResponse = {
  sha: string;
  tree: {
    sha: string;
  };
};

type GitTreeResponse = {
  sha: string;
};

type GitHubPullRequestResponse = {
  html_url: string;
  number: number;
};

type GitHubPullRequestListResponse = Array<{
  html_url: string;
  number: number;
}>;

type GitHubCheckRunsResponse = {
  check_runs?: Array<{
    completed_at?: string | null;
    conclusion?: string | null;
    details_url?: string | null;
    html_url?: string | null;
    name?: string;
    status?: string;
  }>;
};

type GitHubCombinedStatusResponse = {
  statuses?: Array<{
    context?: string;
    description?: string | null;
    state?: string;
    target_url?: string | null;
    updated_at?: string | null;
  }>;
};

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

function buildBranchName(payload: CodexHandoffApprovalPayload): string {
  const taskId = normalizeNotionPageId(payload.taskId);
  const slug = slugifyBranchPart(payload.handoff.suggestedPrTitle || payload.taskName || "implementation");
  return `agent-office/impl-${slug}-${taskId.slice(0, 8)}`;
}

function normalizePrTitle(value: string): string {
  const title = value.trim();
  return title.startsWith("[Draft]") ? title.slice(0, 240) : `[Draft] ${title}`.slice(0, 240);
}

function buildWorkOrderPath(taskId: string): string {
  return `.agent-office/work-orders/${normalizeNotionPageId(taskId)}.md`;
}

function hasUnsafePathSegment(path: string): boolean {
  return path.split("/").some((segment) => !segment || segment === "." || segment === "..");
}

function assertSafeWorkOrderPath(path: string, taskId: string): void {
  const expectedPath = buildWorkOrderPath(taskId);

  if (path !== expectedPath) {
    throw new ImplementationProposalPolicyError(`Implementation work order path must be ${expectedPath}.`);
  }

  if (path.startsWith("/") || path.includes("\\") || hasUnsafePathSegment(path) || path.endsWith("/")) {
    throw new ImplementationProposalPolicyError(`Implementation work order path ${path} is not safe.`);
  }
}

function listMarkdown(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None.";
}

function handoffSummaryFromPayload(payload: CodexHandoffApprovalPayload): ImplementationHandoffSummary {
  return {
    acceptanceChecklist: payload.handoff.acceptanceChecklist,
    constraints: payload.handoff.constraints,
    implementationScope: payload.handoff.implementationScope,
    implementationSteps: payload.handoff.implementationSteps,
    likelyAffectedFiles: payload.handoff.likelyAffectedFiles,
    problemSummary: payload.handoff.problemSummary,
    productIntent: payload.handoff.productIntent,
    suggestedBranchName: payload.handoff.suggestedBranchName,
    suggestedPrTitle: payload.handoff.suggestedPrTitle,
    testsToRun: payload.handoff.testsToRun,
  };
}

function buildPrBody(input: {
  baseBranch: string;
  baseCommitSha: string;
  branchName: string;
  handoffSummary: ImplementationHandoffSummary;
  repository: string;
  taskId: string;
  taskName: string;
  workOrderPath: string;
}): string {
  return [
    "## Implementation pending",
    IMPLEMENTATION_PENDING_NOTICE,
    "",
    "## What Agent Office created",
    `- Repository: ${input.repository}`,
    `- Base: ${input.baseBranch} @ ${input.baseCommitSha}`,
    `- Branch: ${input.branchName}`,
    `- Task: ${input.taskName} (${input.taskId})`,
    `- Work order: \`${input.workOrderPath}\``,
    "",
    "## Next action",
    `- ${IMPLEMENTATION_NEXT_ACTION}`,
    "- Codex should check out this branch, inspect the product repo directly, edit the real product files, run tests, and push implementation commits to this PR.",
    "",
    "## Approved handoff summary",
    `Problem: ${input.handoffSummary.problemSummary}`,
    "",
    `Product intent: ${input.handoffSummary.productIntent}`,
    "",
    "### Implementation scope",
    listMarkdown(input.handoffSummary.implementationScope),
    "",
    "### Likely affected files or modules",
    listMarkdown(input.handoffSummary.likelyAffectedFiles),
    "",
    "### Tests to run",
    listMarkdown(input.handoffSummary.testsToRun),
    "",
    "## Approval boundary",
    "- This draft PR is a starting point for implementation, not the final deliverable.",
    "- Agent Office has not generated or committed product-code changes.",
    "- This PR must not be merged or deployed until Codex implementation, review, tests, and final human approval are complete.",
  ].join("\n");
}

function buildWorkOrderContent(input: {
  baseBranch: string;
  baseCommitSha: string;
  branchName: string;
  handoffSummary: ImplementationHandoffSummary;
  prBody: string;
  prTitle: string;
  repository: string;
  task: AiBuildTask;
  taskId: string;
  taskName: string;
  workOrderPath: string;
}): string {
  return [
    "# Agent Office Implementation Work Order",
    "",
    IMPLEMENTATION_PENDING_NOTICE,
    "",
    "## Task",
    `- Task ID: ${input.taskId}`,
    `- Task name: ${input.taskName}`,
    `- Notion status at preview: ${input.task.status ?? "unknown"}`,
    ...(input.task.url ? [`- Notion URL: ${input.task.url}`] : []),
    "",
    "## Branch and PR Starting Point",
    `- Repository: ${input.repository}`,
    `- Base branch: ${input.baseBranch}`,
    `- Base commit: ${input.baseCommitSha}`,
    `- Branch: ${input.branchName}`,
    `- Draft PR title: ${input.prTitle}`,
    `- Work order path: ${input.workOrderPath}`,
    "",
    "## Next Action",
    IMPLEMENTATION_NEXT_ACTION,
    "",
    "Codex should continue on this branch, inspect the product repository directly, make the real implementation commits, run the relevant checks, and report evidence before human approval.",
    "",
    "## Approved Codex Handoff Summary",
    "",
    "### Problem Summary",
    input.handoffSummary.problemSummary,
    "",
    "### Product Intent",
    input.handoffSummary.productIntent,
    "",
    "### Implementation Scope",
    listMarkdown(input.handoffSummary.implementationScope),
    "",
    "### Likely Affected Files or Modules",
    listMarkdown(input.handoffSummary.likelyAffectedFiles),
    "",
    "### Constraints / Do Not Change",
    listMarkdown(input.handoffSummary.constraints),
    "",
    "### Implementation Steps",
    listMarkdown(input.handoffSummary.implementationSteps),
    "",
    "### Tests to Run",
    listMarkdown(input.handoffSummary.testsToRun),
    "",
    "### Acceptance Checklist",
    listMarkdown(input.handoffSummary.acceptanceChecklist),
    "",
    "## Draft PR Body",
    "```markdown",
    input.prBody,
    "```",
    "",
    "## Approval Boundary",
    "- Agent Office created this work-order commit only.",
    "- Product application files still need to be implemented by Codex on this branch.",
    "- Do not merge or deploy until implementation, review, tests, and final human approval are complete.",
    "",
  ].join("\n");
}

export class ImplementationService {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: ImplementationServiceConfig,
  ) {}

  async createProposalShell(payload: CodexHandoffApprovalPayload): Promise<{
    baseBranch: string;
    baseCommitSha: string;
    branchName: string;
    repository: string;
    taskId: string;
  }> {
    const repository = payload.targetProductRepo;
    const taskId = normalizeNotionPageId(payload.taskId);
    const baseBranch = this.config.defaultBaseBranch;
    const branchName = buildBranchName(payload);

    this.assertPolicy({ baseBranch, branchName, repository });

    return {
      baseBranch,
      baseCommitSha: await this.getBranchSha(repository, baseBranch),
      branchName,
      repository,
      taskId,
    };
  }

  async createWorkOrderProposal(input: {
    payload: CodexHandoffApprovalPayload;
    task: AiBuildTask;
  }): Promise<ImplementationProposal> {
    const shell = await this.createProposalShell(input.payload);
    const taskName = input.payload.taskName ?? input.task.title;
    const workOrderPath = buildWorkOrderPath(shell.taskId);
    const handoffSummary = handoffSummaryFromPayload(input.payload);
    const prTitle = normalizePrTitle(`Implementation pending: ${input.payload.handoff.suggestedPrTitle || taskName}`);
    const prBody = buildPrBody({
      baseBranch: shell.baseBranch,
      baseCommitSha: shell.baseCommitSha,
      branchName: shell.branchName,
      handoffSummary,
      repository: shell.repository,
      taskId: shell.taskId,
      taskName,
      workOrderPath,
    });
    const proposal: ImplementationProposal = {
      approvalWarnings: [
        "Implementation pending. This draft PR is a starting point for Codex implementation, not the final deliverable.",
        "Agent Office will commit only the work-order file. Product code changes must happen later on this branch.",
        "Merge and deployment require separate final human approval.",
      ],
      baseBranch: shell.baseBranch,
      baseCommitSha: shell.baseCommitSha,
      branchName: shell.branchName,
      commitMessage: `Add implementation work order for ${taskName}`.slice(0, 240),
      draft: true,
      handoffSummary,
      nextAction: IMPLEMENTATION_NEXT_ACTION,
      prBody,
      prTitle,
      repository: shell.repository,
      taskId: shell.taskId,
      taskName,
      workOrderContent: "",
      workOrderPath,
    };

    proposal.workOrderContent = buildWorkOrderContent({
      baseBranch: proposal.baseBranch,
      baseCommitSha: proposal.baseCommitSha,
      branchName: proposal.branchName,
      handoffSummary: proposal.handoffSummary,
      prBody: proposal.prBody,
      prTitle: proposal.prTitle,
      repository: proposal.repository,
      task: input.task,
      taskId: proposal.taskId,
      taskName: proposal.taskName,
      workOrderPath: proposal.workOrderPath,
    });

    this.assertProposalPolicy(proposal);
    return proposal;
  }

  async executeProposal(proposal: ImplementationProposal): Promise<ImplementationExecutionResult> {
    this.assertProposalPolicy(proposal);
    const branchExists = await this.branchExists(proposal.repository, proposal.branchName);
    const parentSha = branchExists ? await this.getBranchSha(proposal.repository, proposal.branchName) : proposal.baseCommitSha;

    const commitSha = await this.commitWorkOrder(proposal, parentSha);

    if (branchExists) {
      await this.updateBranch(proposal.repository, proposal.branchName, commitSha);
    } else {
      await this.createBranch(proposal.repository, proposal.branchName, commitSha);
    }

    const pullRequest = await this.upsertDraftPullRequest(proposal);
    const checks = await this.fetchChecks(proposal.repository, commitSha);

    return {
      baseBranch: proposal.baseBranch,
      baseCommitSha: proposal.baseCommitSha,
      branchName: proposal.branchName,
      checks,
      commitSha,
      draft: true,
      nextAction: proposal.nextAction,
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.html_url,
      repository: proposal.repository,
      workOrderPath: proposal.workOrderPath,
    };
  }

  private assertPolicy(input: { baseBranch: string; branchName: string; repository: string }): void {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    assertSafeBaseBranch(input.baseBranch);
    assertSafeWriteBranch(input.branchName, this.config.allowedBranchPrefixes);
  }

  private assertProposalPolicy(proposal: ImplementationProposal): void {
    this.assertPolicy({
      baseBranch: proposal.baseBranch,
      branchName: proposal.branchName,
      repository: proposal.repository,
    });

    if (!proposal.draft) {
      throw new ImplementationProposalPolicyError("Implementation PRs must be draft PRs.");
    }

    assertSafeWorkOrderPath(proposal.workOrderPath, proposal.taskId);

    if (!proposal.prBody.includes(IMPLEMENTATION_PENDING_NOTICE)) {
      throw new ImplementationProposalPolicyError("Implementation PR body must clearly state implementation is pending.");
    }

    if (!proposal.workOrderContent.includes(IMPLEMENTATION_PENDING_NOTICE)) {
      throw new ImplementationProposalPolicyError("Implementation work order must clearly state implementation is pending.");
    }

    if (!proposal.nextAction.includes("Codex")) {
      throw new ImplementationProposalPolicyError("Implementation work order must name the next Codex action.");
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

  private async commitWorkOrder(proposal: ImplementationProposal, parentSha: string): Promise<string> {
    const { owner, repo } = parseRepository(proposal.repository);
    const parentCommit = await this.client.request<GitCommitResponse>({
      path: `/repos/${owner}/${repo}/git/commits/${parentSha}`,
    });
    const tree = await this.client.request<GitTreeResponse>({
      body: {
        base_tree: parentCommit.tree.sha,
        tree: [
          {
            content: proposal.workOrderContent,
            mode: "100644",
            path: proposal.workOrderPath,
            type: "blob",
          },
        ],
      },
      method: "POST",
      path: `/repos/${owner}/${repo}/git/trees`,
    });
    const commit = await this.client.request<GitCommitResponse>({
      body: {
        message: proposal.commitMessage,
        parents: [parentSha],
        tree: tree.sha,
      },
      method: "POST",
      path: `/repos/${owner}/${repo}/git/commits`,
    });

    return commit.sha;
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

  private async updateBranch(repository: string, branchName: string, sha: string): Promise<void> {
    const { owner, repo } = parseRepository(repository);
    await this.client.request<unknown>({
      body: {
        force: false,
        sha,
      },
      method: "PATCH",
      path: `/repos/${owner}/${repo}/git/refs/heads/${encodePathSegment(branchName)}`,
    });
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

  private async upsertDraftPullRequest(proposal: ImplementationProposal): Promise<GitHubPullRequestResponse> {
    const { owner, repo } = parseRepository(proposal.repository);
    const existing = await this.findOpenPullRequestByHead(proposal.repository, proposal.branchName);

    if (existing) {
      return this.client.request<GitHubPullRequestResponse>({
        body: {
          body: proposal.prBody,
          title: proposal.prTitle,
        },
        method: "PATCH",
        path: `/repos/${owner}/${repo}/pulls/${existing.number}`,
      });
    }

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

  private async fetchChecks(repository: string, commitSha: string): Promise<GitHubCheckSummary[]> {
    const { owner, repo } = parseRepository(repository);
    const checks: GitHubCheckSummary[] = [];

    try {
      const response = await this.client.request<GitHubCheckRunsResponse>({
        path: `/repos/${owner}/${repo}/commits/${commitSha}/check-runs`,
      });
      for (const check of response.check_runs ?? []) {
        const detailsUrl = check.details_url ?? check.html_url ?? undefined;
        checks.push({
          ...(check.completed_at ? { completedAt: check.completed_at } : {}),
          ...(check.conclusion !== undefined ? { conclusion: check.conclusion } : {}),
          ...(detailsUrl ? { detailsUrl } : {}),
          name: check.name ?? "GitHub check",
          status: check.status ?? "unknown",
        });
      }
    } catch (error) {
      if (!(error instanceof GitHubApiError && [403, 404].includes(error.statusCode))) {
        throw error;
      }
    }

    try {
      const response = await this.client.request<GitHubCombinedStatusResponse>({
        path: `/repos/${owner}/${repo}/commits/${commitSha}/status`,
      });
      for (const status of response.statuses ?? []) {
        checks.push({
          ...(status.updated_at ? { completedAt: status.updated_at } : {}),
          conclusion: status.state ?? null,
          ...(status.target_url ? { detailsUrl: status.target_url } : {}),
          name: status.context ?? "GitHub status",
          status: status.state ?? "unknown",
        });
      }
    } catch (error) {
      if (!(error instanceof GitHubApiError && [403, 404].includes(error.statusCode))) {
        throw error;
      }
    }

    return checks;
  }
}
