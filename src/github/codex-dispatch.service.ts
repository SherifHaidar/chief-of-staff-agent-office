import type {
  CodexDispatchEvidence,
  CodexDispatchInput,
  CodexDispatchPullRequestEvidence,
} from "../domain/codex-dispatch.js";
import { parseCodexDispatchWorkOrder } from "../domain/codex-dispatch.js";
import { GitHubApiError, type GitHubAppClient } from "./github-app-client.js";
import { assertAllowedRepository } from "./github-policy.js";

export type CodexDispatchServiceConfig = {
  allowedRepositories: string[];
};

type PullRequestResponse = {
  base?: { ref?: string; sha?: string };
  body?: string | null;
  draft?: boolean;
  head?: { ref?: string; sha?: string };
  html_url?: string;
  number?: number;
  state?: string;
  title?: string;
};

type RepositoryContentResponse = {
  content?: string;
  encoding?: string;
  type?: string;
};

export class CodexDispatchCollectionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "CodexDispatchCollectionError";
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

function encodePathSegment(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function extractWorkOrderPath(prBody: string): string | undefined {
  const backtickMatch = prBody.match(/Work order:\s*`([^`]+)`/i);
  if (backtickMatch?.[1]) {
    return backtickMatch[1].trim();
  }

  const plainMatch = prBody.match(/Work order path:\s*([^\n]+)/i);
  return plainMatch?.[1]?.replace(/[`*]/g, "").trim();
}

function hasUnsafePathSegment(path: string): boolean {
  return path.split("/").some((segment) => !segment || segment === "." || segment === "..");
}

function assertSafeWorkOrderPath(path: string): void {
  if (!path.startsWith(".agent-office/work-orders/") || !path.endsWith(".md")) {
    throw new CodexDispatchCollectionError(
      `Work order path ${path} is not an Agent Office work-order markdown file.`,
      409,
    );
  }

  if (path.startsWith("/") || path.includes("\\") || path.endsWith("/") || hasUnsafePathSegment(path)) {
    throw new CodexDispatchCollectionError(`Work order path ${path} is not safe.`, 409);
  }
}

function decodeRepositoryContent(response: RepositoryContentResponse): string {
  if (response.type !== "file" || response.encoding !== "base64" || !response.content) {
    throw new CodexDispatchCollectionError("GitHub content response did not contain a base64 file.", 502);
  }

  return Buffer.from(response.content.replace(/\n/g, ""), "base64").toString("utf8");
}

export class CodexDispatchService {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: CodexDispatchServiceConfig,
  ) {}

  async collectEvidence(input: CodexDispatchInput, collectedAt = new Date()): Promise<CodexDispatchEvidence> {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    const { body, ...pullRequest } = await this.fetchPullRequest(input);
    const workOrderPath = extractWorkOrderPath(body ?? "");

    if (!workOrderPath) {
      throw new CodexDispatchCollectionError(
        `Pull request ${input.repository}#${input.pullRequestNumber} does not expose a work-order file path.`,
        409,
      );
    }

    assertSafeWorkOrderPath(workOrderPath);
    const markdown = await this.fetchWorkOrderMarkdown(input.repository, pullRequest.headBranch, workOrderPath);

    return {
      collectedAt: collectedAt.toISOString(),
      pullRequest,
      workOrder: parseCodexDispatchWorkOrder({
        markdown,
        path: workOrderPath,
      }),
    };
  }

  private async fetchPullRequest(input: CodexDispatchInput): Promise<CodexDispatchPullRequestEvidence & { body?: string }> {
    const { owner, repo } = parseRepository(input.repository);
    let response: PullRequestResponse;

    try {
      response = await this.client.request<PullRequestResponse>({
        path: `/repos/${owner}/${repo}/pulls/${input.pullRequestNumber}`,
      });
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        throw new CodexDispatchCollectionError(
          `Pull request ${input.repository}#${input.pullRequestNumber} is missing or inaccessible: ${error.message}`,
          error.statusCode,
        );
      }

      throw error;
    }

    if (
      !response.title ||
      !response.html_url ||
      !response.number ||
      !response.base?.ref ||
      !response.head?.ref ||
      !response.head.sha
    ) {
      throw new CodexDispatchCollectionError(
        `Pull request ${input.repository}#${input.pullRequestNumber} is missing required metadata.`,
        502,
      );
    }

    return {
      ...(response.base.sha ? { baseCommitSha: response.base.sha } : {}),
      baseBranch: response.base.ref,
      body: response.body ?? "",
      draft: response.draft ?? false,
      headBranch: response.head.ref,
      headSha: response.head.sha,
      pullRequestNumber: response.number,
      repository: input.repository,
      state: response.state ?? "unknown",
      title: response.title,
      url: response.html_url,
    };
  }

  private async fetchWorkOrderMarkdown(repository: string, headBranch: string, path: string): Promise<string> {
    const { owner, repo } = parseRepository(repository);

    try {
      const response = await this.client.request<RepositoryContentResponse>({
        path: `/repos/${owner}/${repo}/contents/${encodePathSegment(path)}`,
        query: { ref: headBranch },
      });

      return decodeRepositoryContent(response);
    } catch (error) {
      if (error instanceof GitHubApiError && [403, 404].includes(error.statusCode)) {
        throw new CodexDispatchCollectionError(`Unable to read work-order file ${path}: ${error.message}`, error.statusCode);
      }

      throw error;
    }
  }
}
