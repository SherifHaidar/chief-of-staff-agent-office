import type {
  PostMergeCloseoutCheck,
  PostMergeCloseoutDeploymentEvidence,
  PostMergeCloseoutEvidence,
  PostMergeCloseoutInput,
} from "../domain/post-merge-closeout.js";
import { GitHubApiError, type GitHubAppClient } from "./github-app-client.js";
import { assertAllowedRepository } from "./github-policy.js";

export type PostMergeCloseoutServiceConfig = {
  allowedRepositories: string[];
};

type PullRequestResponse = {
  base?: { ref?: string };
  head?: { ref?: string; sha?: string };
  html_url?: string;
  merge_commit_sha?: string | null;
  merged?: boolean;
  merged_at?: string | null;
  merged_by?: { login?: string } | null;
  number?: number;
  state?: string;
  title?: string;
};

type DeploymentsResponse = Array<{
  environment?: string;
  id?: number;
}>;

type DeploymentStatusesResponse = Array<{
  environment?: string;
  log_url?: string | null;
  state?: string;
  target_url?: string | null;
  updated_at?: string | null;
}>;

export class PostMergeCloseoutError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PostMergeCloseoutError";
  }
}

function parseRepository(repository: string): { owner: string; repo: string } {
  const parts = repository.split("/");
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo || parts.length !== 2) {
    throw new Error(`Invalid GitHub repository ${repository}. Expected owner/name.`);
  }

  return { owner, repo };
}

export class PostMergeCloseoutService {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: PostMergeCloseoutServiceConfig,
  ) {}

  async collectEvidence(input: PostMergeCloseoutInput, collectedAt = new Date()): Promise<PostMergeCloseoutEvidence> {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    const pullRequest = await this.fetchMergedPullRequest(input);
    const deployment = await this.fetchDeploymentEvidence(input.repository, pullRequest.mergeSha);

    return {
      collectedAt: collectedAt.toISOString(),
      deployment,
      pullRequest,
    };
  }

  private async fetchMergedPullRequest(input: PostMergeCloseoutInput): Promise<PostMergeCloseoutEvidence["pullRequest"]> {
    const { owner, repo } = parseRepository(input.repository);
    let response: PullRequestResponse;

    try {
      response = await this.client.request<PullRequestResponse>({
        path: `/repos/${owner}/${repo}/pulls/${input.pullRequestNumber}`,
      });
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        throw new PostMergeCloseoutError(
          `Pull request ${input.repository}#${input.pullRequestNumber} is missing or inaccessible: ${error.message}`,
          error.statusCode,
        );
      }

      throw error;
    }

    if (!response.title || !response.html_url || !response.number || !response.base?.ref || !response.head?.ref) {
      throw new PostMergeCloseoutError(
        `Pull request ${input.repository}#${input.pullRequestNumber} is missing required metadata.`,
        502,
      );
    }

    if (!response.merged || !response.merge_commit_sha || !response.merged_at) {
      throw new PostMergeCloseoutError(
        `Pull request ${input.repository}#${input.pullRequestNumber} is not merged. Post-Merge Closeout only records already-merged PRs.`,
        409,
      );
    }

    return {
      baseBranch: response.base.ref,
      headBranch: response.head.ref,
      ...(response.head.sha ? { headSha: response.head.sha } : {}),
      mergeSha: response.merge_commit_sha,
      merged: true,
      mergedAt: response.merged_at,
      ...(response.merged_by?.login ? { mergedBy: response.merged_by.login } : {}),
      pullRequestNumber: response.number,
      repository: input.repository,
      state: response.state ?? "unknown",
      title: response.title,
      url: response.html_url,
    };
  }

  private async fetchDeploymentEvidence(
    repository: string,
    mergeSha: string,
  ): Promise<PostMergeCloseoutDeploymentEvidence> {
    const { owner, repo } = parseRepository(repository);

    try {
      const response = await this.client.request<DeploymentsResponse>({
        path: `/repos/${owner}/${repo}/deployments`,
        query: { per_page: "5", sha: mergeSha },
      });

      if (response.length === 0) {
        return {
          deployments: [],
          message: "No GitHub deployment records were found for the merge commit.",
          status: "missing",
        };
      }

      const deployments: PostMergeCloseoutDeploymentEvidence["deployments"] = [];
      for (const deployment of response.slice(0, 5)) {
        const statuses = await this.fetchDeploymentStatuses(repository, deployment.id);
        const latestStatus = statuses[0];
        const latestState = latestStatus?.conclusion ?? latestStatus?.status;
        deployments.push({
          ...(deployment.environment ? { environment: deployment.environment } : {}),
          ...(latestState ? { state: latestState } : {}),
          statuses,
          ...(latestStatus?.detailsUrl ? { url: latestStatus.detailsUrl } : {}),
        });
      }

      return {
        deployments,
        status: "found",
      };
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        return {
          deployments: [],
          message: `Unable to read GitHub deployment evidence: ${error.message}`,
          status: "unavailable",
        };
      }

      throw error;
    }
  }

  private async fetchDeploymentStatuses(repository: string, deploymentId: number | undefined): Promise<PostMergeCloseoutCheck[]> {
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
        return [
          {
            conclusion: "unavailable",
            name: `Deployment ${deploymentId}`,
            status: "unavailable",
          },
        ];
      }

      throw error;
    }
  }
}
