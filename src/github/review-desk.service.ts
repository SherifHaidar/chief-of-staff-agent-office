import type {
  ReviewDeskChangedFile,
  ReviewDeskCheck,
  ReviewDeskDeployment,
  ReviewDeskInput,
  ReviewDeskPullRequestEvidence,
} from "../domain/review-desk.js";
import { GitHubApiError, type GitHubAppClient } from "./github-app-client.js";
import { assertAllowedRepository } from "./github-policy.js";

export type ReviewDeskServiceConfig = {
  allowedRepositories: string[];
  maxChangedFiles: number;
  maxPatchChars: number;
};

type PullRequestResponse = {
  base?: { ref?: string };
  body?: string | null;
  draft?: boolean;
  head?: { ref?: string; sha?: string };
  html_url?: string;
  number?: number;
  state?: string;
  title?: string;
  user?: { login?: string };
};

type PullRequestFileResponse = Array<{
  additions?: number;
  changes?: number;
  deletions?: number;
  filename?: string;
  patch?: string;
  status?: string;
}>;

type CheckRunsResponse = {
  check_runs?: Array<{
    completed_at?: string | null;
    conclusion?: string | null;
    details_url?: string | null;
    html_url?: string | null;
    name?: string;
    status?: string;
  }>;
};

type CombinedStatusResponse = {
  statuses?: Array<{
    context?: string;
    description?: string | null;
    state?: string;
    target_url?: string | null;
    updated_at?: string | null;
  }>;
};

type DeploymentsResponse = Array<{
  environment?: string;
  id?: number;
  latest_statuses_url?: string;
  statuses_url?: string;
  url?: string;
}>;

type DeploymentStatusesResponse = Array<{
  environment?: string;
  log_url?: string | null;
  state?: string;
  target_url?: string | null;
  updated_at?: string | null;
}>;

type RepositoryContentResponse = {
  content?: string;
  encoding?: string;
  type?: string;
};

function parseRepository(repository: string): { owner: string; repo: string } {
  const parts = repository.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo || parts.length !== 2) {
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

function truncate(value: string | undefined, maxChars: number): { text?: string; truncated: boolean } {
  if (!value) {
    return { truncated: false };
  }

  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }

  return { text: `${value.slice(0, maxChars)}\n...[truncated]`, truncated: true };
}

function extractWorkOrderPath(prBody: string): string | undefined {
  const match = prBody.match(/Work order:\s*`([^`]+)`/i);
  return match?.[1]?.trim();
}

function decodeRepositoryContent(response: RepositoryContentResponse): string {
  if (response.type !== "file" || response.encoding !== "base64" || !response.content) {
    throw new Error("GitHub content response did not contain a base64 file.");
  }

  return Buffer.from(response.content.replace(/\n/g, ""), "base64").toString("utf8");
}

export class ReviewDeskService {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: ReviewDeskServiceConfig,
  ) {}

  async collectPullRequestEvidence(input: ReviewDeskInput): Promise<ReviewDeskPullRequestEvidence> {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    const { owner, repo } = parseRepository(input.repository);
    const pullRequest = await this.client.request<PullRequestResponse>({
      path: `/repos/${owner}/${repo}/pulls/${input.pullRequestNumber}`,
    });
    const headSha = pullRequest.head?.sha;
    const body = pullRequest.body ?? "";

    if (!pullRequest.title || !pullRequest.html_url || !pullRequest.number || !pullRequest.base?.ref || !pullRequest.head?.ref || !headSha) {
      throw new Error(`Pull request ${input.repository}#${input.pullRequestNumber} is missing required metadata.`);
    }

    const collectionWarnings: string[] = [];
    const changedFiles = await this.fetchChangedFiles(input.repository, input.pullRequestNumber, collectionWarnings);
    const checks = await this.fetchChecks(input.repository, headSha, collectionWarnings);
    const deployments = await this.fetchDeployments(input.repository, headSha, collectionWarnings);

    return {
      ...(pullRequest.user?.login ? { author: pullRequest.user.login } : {}),
      baseBranch: pullRequest.base.ref,
      body,
      changedFiles,
      checks,
      collectionWarnings,
      deployments,
      draft: pullRequest.draft ?? false,
      headBranch: pullRequest.head.ref,
      headSha,
      pullRequestNumber: pullRequest.number,
      repository: input.repository,
      state: pullRequest.state ?? "unknown",
      title: pullRequest.title,
      url: pullRequest.html_url,
    };
  }

  async fetchWorkOrderFromPullRequest(input: {
    body: string;
    headBranch: string;
    repository: string;
  }): Promise<{ markdown?: string; path?: string; warning?: string }> {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    const path = extractWorkOrderPath(input.body);
    if (!path) {
      return { warning: "PR body does not contain a work-order file path." };
    }

    const { owner, repo } = parseRepository(input.repository);
    try {
      const response = await this.client.request<RepositoryContentResponse>({
        path: `/repos/${owner}/${repo}/contents/${encodePathSegment(path)}`,
        query: { ref: input.headBranch },
      });

      return { markdown: decodeRepositoryContent(response), path };
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        return { path, warning: `Unable to read work-order file ${path}: ${error.message}` };
      }

      throw error;
    }
  }

  private async fetchChangedFiles(
    repository: string,
    pullRequestNumber: number,
    collectionWarnings: string[],
  ): Promise<ReviewDeskChangedFile[]> {
    const { owner, repo } = parseRepository(repository);
    const response = await this.client.request<PullRequestFileResponse>({
      path: `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/files`,
      query: { per_page: "100" },
    });

    if (response.length > this.config.maxChangedFiles) {
      collectionWarnings.push(
        `PR changed ${response.length} files; Review Desk included the first ${this.config.maxChangedFiles} file patches.`,
      );
    }

    return response.slice(0, this.config.maxChangedFiles).flatMap((file): ReviewDeskChangedFile[] => {
      if (!file.filename) {
        return [];
      }

      const patch = truncate(file.patch, this.config.maxPatchChars);
      return [
        {
          additions: file.additions ?? 0,
          deletions: file.deletions ?? 0,
          ...(patch.text ? { patch: patch.text } : {}),
          patchTruncated: patch.truncated,
          path: file.filename,
          status: file.status ?? "modified",
        },
      ];
    });
  }

  private async fetchChecks(
    repository: string,
    commitSha: string,
    collectionWarnings: string[],
  ): Promise<ReviewDeskCheck[]> {
    const { owner, repo } = parseRepository(repository);
    const checks: ReviewDeskCheck[] = [];

    try {
      const response = await this.client.request<CheckRunsResponse>({
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
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        collectionWarnings.push(`Unable to read GitHub check runs: ${error.message}`);
      } else {
        throw error;
      }
    }

    try {
      const response = await this.client.request<CombinedStatusResponse>({
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
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        collectionWarnings.push(`Unable to read GitHub statuses: ${error.message}`);
      } else {
        throw error;
      }
    }

    return checks;
  }

  private async fetchDeployments(
    repository: string,
    commitSha: string,
    collectionWarnings: string[],
  ): Promise<ReviewDeskDeployment[]> {
    const { owner, repo } = parseRepository(repository);

    try {
      const response = await this.client.request<DeploymentsResponse>({
        path: `/repos/${owner}/${repo}/deployments`,
        query: { per_page: "5", sha: commitSha },
      });
      const deployments: ReviewDeskDeployment[] = [];

      for (const deployment of response.slice(0, 5)) {
        const statuses = await this.fetchDeploymentStatuses(repository, deployment.id, collectionWarnings);
        const latestStatus = statuses[0];
        const latestState = latestStatus?.conclusion ?? latestStatus?.status;
        deployments.push({
          ...(deployment.environment ? { environment: deployment.environment } : {}),
          ...(latestState ? { state: latestState } : {}),
          statuses,
          ...(latestStatus?.detailsUrl ? { url: latestStatus.detailsUrl } : {}),
        });
      }

      return deployments;
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        collectionWarnings.push(`Unable to read GitHub deployment evidence: ${error.message}`);
        return [];
      }

      throw error;
    }
  }

  private async fetchDeploymentStatuses(
    repository: string,
    deploymentId: number | undefined,
    collectionWarnings: string[],
  ): Promise<ReviewDeskCheck[]> {
    if (!deploymentId) {
      return [];
    }

    const { owner, repo } = parseRepository(repository);

    try {
      const response = await this.client.request<DeploymentStatusesResponse>({
        path: `/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`,
        query: { per_page: "3" },
      });

      return response.map((status) => ({
        ...(status.updated_at ? { completedAt: status.updated_at } : {}),
        conclusion: status.state ?? null,
        ...(status.target_url ?? status.log_url ? { detailsUrl: status.target_url ?? status.log_url ?? undefined } : {}),
        name: status.environment ? `Deployment: ${status.environment}` : "Deployment",
        status: status.state ?? "unknown",
      }));
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        collectionWarnings.push(`Unable to read deployment ${deploymentId} statuses: ${error.message}`);
        return [];
      }

      throw error;
    }
  }
}
