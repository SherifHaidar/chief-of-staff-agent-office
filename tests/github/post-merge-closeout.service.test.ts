import { describe, expect, it, vi } from "vitest";

import { GitHubApiError, type GitHubAppClient } from "../../src/github/github-app-client.js";
import { PostMergeCloseoutService } from "../../src/github/post-merge-closeout.service.js";

const input = {
  pullRequestNumber: 21,
  repository: "SherifHaidar/chief-of-staff-agent-office",
  taskId: "22222222-2222-2222-2222-222222222222",
};

function createClient(request = vi.fn()) {
  return { request } as unknown as GitHubAppClient;
}

function createService(request = vi.fn()) {
  return new PostMergeCloseoutService(createClient(request), {
    allowedRepositories: ["SherifHaidar/chief-of-staff-agent-office"],
  });
}

const mergedPullRequestResponse = {
  base: { ref: "main" },
  head: { ref: "agent-office/impl-closeout", sha: "head-sha" },
  html_url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/21",
  merge_commit_sha: "merge-sha",
  merged: true,
  merged_at: "2026-05-17T11:00:00.000Z",
  merged_by: { login: "SherifHaidar" },
  number: 21,
  state: "closed",
  title: "Add Post-Merge Closeout v0",
};

describe("PostMergeCloseoutService", () => {
  it("collects merged PR and deployment evidence", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(mergedPullRequestResponse)
      .mockResolvedValueOnce([{ environment: "Preview", id: 123 }])
      .mockResolvedValueOnce([
        {
          environment: "Preview",
          state: "success",
          target_url: "https://preview.example",
          updated_at: "2026-05-17T11:05:00.000Z",
        },
      ]);
    const service = createService(request);

    const evidence = await service.collectEvidence(input, new Date("2026-05-17T12:00:00.000Z"));

    expect(evidence).toMatchObject({
      collectedAt: "2026-05-17T12:00:00.000Z",
      deployment: {
        deployments: [
          {
            environment: "Preview",
            state: "success",
            url: "https://preview.example",
          },
        ],
        status: "found",
      },
      pullRequest: {
        mergeSha: "merge-sha",
        merged: true,
        repository: "SherifHaidar/chief-of-staff-agent-office",
      },
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/repos/SherifHaidar/chief-of-staff-agent-office/deployments",
        query: { per_page: "5", sha: "merge-sha" },
      }),
    );
  });

  it("rejects unmerged PRs", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      ...mergedPullRequestResponse,
      merge_commit_sha: null,
      merged: false,
      merged_at: null,
    });
    const service = createService(request);

    await expect(service.collectEvidence(input)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("records missing deployment evidence without blocking closeout", async () => {
    const request = vi.fn().mockResolvedValueOnce(mergedPullRequestResponse).mockResolvedValueOnce([]);
    const service = createService(request);

    const evidence = await service.collectEvidence(input);

    expect(evidence.deployment).toEqual({
      deployments: [],
      message: "No GitHub deployment records were found for the merge commit.",
      status: "missing",
    });
  });

  it("records unavailable deployment evidence when GitHub deployment access is missing", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(mergedPullRequestResponse)
      .mockRejectedValueOnce(new GitHubApiError("Resource not accessible by integration", 403));
    const service = createService(request);

    const evidence = await service.collectEvidence(input);

    expect(evidence.deployment).toMatchObject({
      message: expect.stringContaining("Unable to read GitHub deployment evidence"),
      status: "unavailable",
    });
  });
});
