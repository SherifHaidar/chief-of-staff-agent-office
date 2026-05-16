import type { CodexHandoffApprovalPayload } from "../approval/codex-handoff-approval.js";
import type {
  GitHubCheckSummary,
  ImplementationEvidenceSummary,
  ImplementationExecutionResult,
  ImplementationFileChange,
  ImplementationProposal,
} from "../domain/implementation-proposal.js";
import type { ProductContextPack } from "../domain/product-context-pack.js";
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

type GitHubContentsMetadataResponse = {
  sha?: string;
  type?: string;
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

function hasUnsafePathSegment(path: string): boolean {
  return path.split("/").some((segment) => !segment || segment === "." || segment === "..");
}

function isProtectedPath(path: string): boolean {
  const lower = path.toLowerCase();

  return (
    lower.startsWith(".env") ||
    lower.includes("/.env") ||
    lower.startsWith(".github/") ||
    lower.startsWith(".vercel/") ||
    lower === "vercel.json" ||
    lower === "package.json" ||
    lower.endsWith("lock.json") ||
    lower.endsWith("lock.yaml") ||
    lower.endsWith("lock.yml") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key")
  );
}

function assertSafeFileChangePath(path: string): void {
  if (path.startsWith("/") || path.includes("\\") || hasUnsafePathSegment(path) || path.endsWith("/")) {
    throw new ImplementationProposalPolicyError(`Implementation file path ${path} is not safe.`);
  }

  if (isProtectedPath(path)) {
    throw new ImplementationProposalPolicyError(
      `Implementation proposal may not edit protected path ${path} in v0.`,
    );
  }
}

function totalChangeChars(changes: ImplementationFileChange[]): number {
  return changes.reduce((total, change) => total + change.content.length, 0);
}

function summarizeChecks(checks: GitHubCheckSummary[]): ImplementationEvidenceSummary {
  if (checks.length === 0) {
    return {
      automatedChecksSummary: "No GitHub checks reported for the implementation commit yet.",
      evidence: ["Draft PR and implementation commit were created."],
      verificationGaps: ["Automated GitHub checks were not available yet; Sherif should refresh the PR and verify manually."],
    };
  }

  const failed = checks.filter(
    (check) => check.conclusion && !["success", "neutral", "skipped", "pending"].includes(check.conclusion),
  );
  const pending = checks.filter(
    (check) =>
      ["pending", "queued", "in_progress"].includes(check.status) ||
      check.conclusion === "pending" ||
      !check.conclusion,
  );

  return {
    automatedChecksSummary:
      failed.length > 0
        ? `${failed.length} GitHub check(s) reported a non-success conclusion.`
        : pending.length > 0
          ? `${pending.length} GitHub check(s) are still pending.`
          : "GitHub checks reported no failing conclusions at capture time.",
    evidence: checks.map((check) => `${check.name}: ${check.conclusion ?? check.status}`),
    verificationGaps: pending.length > 0 ? ["Some GitHub checks were still pending when evidence was captured."] : [],
  };
}

export class ImplementationService {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: ImplementationServiceConfig,
  ) {}

  limits(): Pick<ImplementationServiceConfig, "maxChangedFiles" | "maxFileChars" | "maxTotalChangeChars"> {
    return {
      maxChangedFiles: this.config.maxChangedFiles,
      maxFileChars: this.config.maxFileChars,
      maxTotalChangeChars: this.config.maxTotalChangeChars,
    };
  }

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

  finalizeProposal(input: {
    payload: CodexHandoffApprovalPayload;
    productContext?: ProductContextPack;
    proposal: ImplementationProposal;
    shell: {
      baseBranch: string;
      baseCommitSha: string;
      branchName: string;
      repository: string;
      taskId: string;
    };
  }): ImplementationProposal {
    const taskName = input.payload.taskName ?? input.proposal.taskName;
    if (!taskName) {
      throw new ImplementationProposalPolicyError("Implementation proposals require a task name.");
    }

    const proposal = {
      ...input.proposal,
      baseBranch: input.shell.baseBranch,
      baseCommitSha: input.shell.baseCommitSha,
      branchName: input.shell.branchName,
      draft: true as const,
      prTitle: normalizePrTitle(input.proposal.prTitle),
      repository: input.shell.repository,
      taskId: input.shell.taskId,
      taskName,
    };

    this.assertProposalPolicy(proposal, input.productContext);
    return proposal;
  }

  async executeProposal(proposal: ImplementationProposal): Promise<ImplementationExecutionResult> {
    this.assertProposalPolicy(proposal);
    const branchExists = await this.branchExists(proposal.repository, proposal.branchName);
    const parentSha = branchExists ? await this.getBranchSha(proposal.repository, proposal.branchName) : proposal.baseCommitSha;

    await this.assertFileExistenceMatchesActions(proposal, parentSha);

    const commitSha = await this.commitFileChanges(proposal, parentSha);

    if (branchExists) {
      await this.updateBranch(proposal.repository, proposal.branchName, commitSha);
    } else {
      await this.createBranch(proposal.repository, proposal.branchName, commitSha);
    }

    const pullRequest = await this.upsertDraftPullRequest(proposal);
    const checks = await this.fetchChecks(proposal.repository, commitSha);
    const evidence = summarizeChecks(checks);

    return {
      baseBranch: proposal.baseBranch,
      baseCommitSha: proposal.baseCommitSha,
      branchName: proposal.branchName,
      changedFiles: proposal.changedFiles.map((change) => ({
        action: change.action,
        path: change.path,
        summary: change.summary,
      })),
      checks,
      commitSha,
      draft: true,
      evidence,
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

  private assertProposalPolicy(proposal: ImplementationProposal, productContext?: ProductContextPack): void {
    this.assertPolicy({
      baseBranch: proposal.baseBranch,
      branchName: proposal.branchName,
      repository: proposal.repository,
    });

    if (!proposal.draft) {
      throw new ImplementationProposalPolicyError("Implementation PRs must be draft PRs.");
    }

    if (proposal.changedFiles.length > this.config.maxChangedFiles) {
      throw new ImplementationProposalPolicyError(
        `Implementation proposal changes ${proposal.changedFiles.length} files; v0 limit is ${this.config.maxChangedFiles}.`,
      );
    }

    if (totalChangeChars(proposal.changedFiles) > this.config.maxTotalChangeChars) {
      throw new ImplementationProposalPolicyError(
        `Implementation proposal exceeds the ${this.config.maxTotalChangeChars} character total change limit.`,
      );
    }

    const knownCompleteContextPaths = new Set(
      productContext?.repoContext?.files.filter((file) => !file.truncated).map((file) => file.path) ?? [],
    );

    for (const change of proposal.changedFiles) {
      assertSafeFileChangePath(change.path);

      if (change.content.length > this.config.maxFileChars) {
        throw new ImplementationProposalPolicyError(
          `Implementation proposal file ${change.path} exceeds the ${this.config.maxFileChars} character file limit.`,
        );
      }

      if (change.action === "update" && productContext && !knownCompleteContextPaths.has(change.path)) {
        throw new ImplementationProposalPolicyError(
          `Implementation proposal updates ${change.path}, but that file was not fully included in the Product Context Pack.`,
        );
      }
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

  private async contentExists(repository: string, path: string, ref: string): Promise<boolean> {
    const { owner, repo } = parseRepository(repository);

    try {
      const response = await this.client.request<GitHubContentsMetadataResponse>({
        path: `/repos/${owner}/${repo}/contents/${encodePathSegment(path)}`,
        query: { ref },
      });

      return response.type === "file" || Boolean(response.sha);
    } catch (error) {
      if (error instanceof GitHubApiError && error.statusCode === 404) {
        return false;
      }

      throw error;
    }
  }

  private async assertFileExistenceMatchesActions(proposal: ImplementationProposal, ref: string): Promise<void> {
    for (const change of proposal.changedFiles) {
      const exists = await this.contentExists(proposal.repository, change.path, ref);

      if (change.action === "create" && exists) {
        throw new ImplementationProposalPolicyError(`Implementation proposal cannot create existing file ${change.path}.`);
      }

      if (change.action === "update" && !exists) {
        throw new ImplementationProposalPolicyError(`Implementation proposal cannot update missing file ${change.path}.`);
      }
    }
  }

  private async commitFileChanges(proposal: ImplementationProposal, parentSha: string): Promise<string> {
    const { owner, repo } = parseRepository(proposal.repository);
    const parentCommit = await this.client.request<GitCommitResponse>({
      path: `/repos/${owner}/${repo}/git/commits/${parentSha}`,
    });
    const tree = await this.client.request<GitTreeResponse>({
      body: {
        base_tree: parentCommit.tree.sha,
        tree: proposal.changedFiles.map((change) => ({
          content: change.content,
          mode: "100644",
          path: change.path,
          type: "blob",
        })),
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
