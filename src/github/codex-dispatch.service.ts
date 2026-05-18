import type {
  CodexDispatchEvidence,
  CodexDispatchInput,
  CodexDispatchPostedComment,
  CodexDispatchPullRequestEvidence,
  CodexDispatchSignal,
  CodexDispatchStatusInput,
  CodexDispatchStatusReport,
} from "../domain/codex-dispatch.js";
import {
  CODEX_DISPATCH_AWAITING_STATUS,
  CODEX_DISPATCH_BOT_LOGIN_FRAGMENT,
  CodexDispatchPostedCommentSchema,
  CodexDispatchStatusReportSchema,
  parseCodexDispatchWorkOrder,
} from "../domain/codex-dispatch.js";
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

type IssueCommentResponse = {
  body?: string;
  created_at?: string;
  html_url?: string;
  id?: number;
  user?: { login?: string };
};

type PullRequestReviewResponse = {
  body?: string;
  html_url?: string;
  id?: number;
  submitted_at?: string;
  user?: { login?: string };
};

type PullRequestReviewCommentResponse = {
  body?: string;
  created_at?: string;
  html_url?: string;
  id?: number;
  user?: { login?: string };
};

type PullRequestCommitResponse = {
  commit?: {
    author?: { date?: string; name?: string };
    committer?: { date?: string; name?: string };
    message?: string;
  };
  html_url?: string;
  sha?: string;
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

  async postDispatchComment(input: {
    body: string;
    pullRequestNumber: number;
    repository: string;
  }): Promise<CodexDispatchPostedComment> {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    const { owner, repo } = parseRepository(input.repository);
    const response = await this.client.request<IssueCommentResponse>({
      body: { body: input.body },
      method: "POST",
      path: `/repos/${owner}/${repo}/issues/${input.pullRequestNumber}/comments`,
    });

    return CodexDispatchPostedCommentSchema.parse({
      author: response.user?.login ?? "unknown",
      body: response.body ?? input.body,
      createdAt: response.created_at,
      id: response.id,
      url: response.html_url,
    });
  }

  async collectStatus(input: CodexDispatchStatusInput, checkedAt = new Date()): Promise<CodexDispatchStatusReport> {
    assertAllowedRepository(input.repository, this.config.allowedRepositories);
    const [issueComments, reviews, reviewComments, commits] = await Promise.all([
      this.fetchIssueComments(input.repository, input.pullRequestNumber),
      this.fetchPullRequestReviews(input.repository, input.pullRequestNumber),
      this.fetchPullRequestReviewComments(input.repository, input.pullRequestNumber),
      this.fetchPullRequestCommits(input.repository, input.pullRequestNumber),
    ]);
    const since = new Date(input.dispatchCommentCreatedAt).getTime();
    const signals: CodexDispatchSignal[] = [];

    for (const comment of issueComments) {
      const createdAt = comment.created_at;
      const actor = comment.user?.login;
      if (!createdAt || new Date(createdAt).getTime() <= since || !isCodexActor(actor)) {
        continue;
      }

      signals.push({
        ...(actor ? { actor } : {}),
        createdAt,
        summary: summarizeCodexBody(comment.body, "Codex PR comment detected."),
        type: bodyLooksLikeCodexTask(comment.body) ? "codex_task" : "codex_comment",
        ...(comment.html_url ? { url: comment.html_url } : {}),
      });
    }

    for (const review of reviews) {
      const createdAt = review.submitted_at;
      const actor = review.user?.login;
      if (!createdAt || new Date(createdAt).getTime() <= since || !isCodexActor(actor)) {
        continue;
      }

      signals.push({
        ...(actor ? { actor } : {}),
        createdAt,
        summary: summarizeCodexBody(review.body, "Codex review detected."),
        type: bodyLooksLikeCodexTask(review.body) ? "codex_task" : "codex_review",
        ...(review.html_url ? { url: review.html_url } : {}),
      });
    }

    for (const comment of reviewComments) {
      const createdAt = comment.created_at;
      const actor = comment.user?.login;
      if (!createdAt || new Date(createdAt).getTime() <= since || !isCodexActor(actor)) {
        continue;
      }

      signals.push({
        ...(actor ? { actor } : {}),
        createdAt,
        summary: summarizeCodexBody(comment.body, "Codex review-thread comment detected."),
        type: bodyLooksLikeCodexTask(comment.body) ? "codex_task" : "codex_comment",
        ...(comment.html_url ? { url: comment.html_url } : {}),
      });
    }

    for (const commit of commits) {
      const createdAt = commit.commit?.author?.date ?? commit.commit?.committer?.date;
      if (!createdAt || new Date(createdAt).getTime() <= since) {
        continue;
      }

      signals.push({
        actor: commit.commit?.author?.name ?? commit.commit?.committer?.name ?? "unknown",
        createdAt,
        summary: `PR commit after @codex dispatch: ${commit.sha?.slice(0, 10) ?? "unknown"} - ${
          firstLine(commit.commit?.message) ?? "no commit message"
        }`,
        type: "commit",
        ...(commit.html_url ? { url: commit.html_url } : {}),
      });
    }

    signals.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const hasCommit = signals.some((signal) => signal.type === "commit");
    const hasTask = signals.some((signal) => signal.type === "codex_task");
    const hasCodexResponse = signals.some((signal) => signal.type === "codex_comment" || signal.type === "codex_review");
    const label = hasCommit
      ? "Codex pushed/applied commits"
      : hasTask
        ? "Codex created a task"
        : hasCodexResponse
          ? "Codex responded/reviewed"
          : CODEX_DISPATCH_AWAITING_STATUS;

    return CodexDispatchStatusReportSchema.parse({
      checkedAt: checkedAt.toISOString(),
      dispatchCommentCreatedAt: input.dispatchCommentCreatedAt,
      ...(input.dispatchCommentId ? { dispatchCommentId: input.dispatchCommentId } : {}),
      label,
      signals,
      summary:
        signals.length > 0
          ? `${signals.length} GitHub signal${signals.length === 1 ? "" : "s"} found after the @codex dispatch comment.`
          : "No Codex response, review, task, or new PR commit evidence found after the @codex dispatch comment.",
    });
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

  private async fetchIssueComments(repository: string, pullRequestNumber: number): Promise<IssueCommentResponse[]> {
    const { owner, repo } = parseRepository(repository);
    return this.client.request<IssueCommentResponse[]>({
      path: `/repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`,
      query: { per_page: "100" },
    });
  }

  private async fetchPullRequestReviews(repository: string, pullRequestNumber: number): Promise<PullRequestReviewResponse[]> {
    const { owner, repo } = parseRepository(repository);
    return this.client.request<PullRequestReviewResponse[]>({
      path: `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/reviews`,
      query: { per_page: "100" },
    });
  }

  private async fetchPullRequestReviewComments(
    repository: string,
    pullRequestNumber: number,
  ): Promise<PullRequestReviewCommentResponse[]> {
    const { owner, repo } = parseRepository(repository);
    return this.client.request<PullRequestReviewCommentResponse[]>({
      path: `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/comments`,
      query: { per_page: "100" },
    });
  }

  private async fetchPullRequestCommits(repository: string, pullRequestNumber: number): Promise<PullRequestCommitResponse[]> {
    const { owner, repo } = parseRepository(repository);
    return this.client.request<PullRequestCommitResponse[]>({
      path: `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/commits`,
      query: { per_page: "100" },
    });
  }
}

function isCodexActor(actor: string | undefined): boolean {
  return Boolean(actor?.toLowerCase().includes(CODEX_DISPATCH_BOT_LOGIN_FRAGMENT));
}

function bodyLooksLikeCodexTask(body: string | undefined): boolean {
  const normalized = body?.toLowerCase() ?? "";
  return normalized.includes("view task") || normalized.includes("chatgpt.com/s/") || normalized.includes("codex cloud task");
}

function firstLine(value: string | undefined): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function summarizeCodexBody(body: string | undefined, fallback: string): string {
  return firstLine(body)?.replace(/^#+\s*/, "").slice(0, 240) || fallback;
}
