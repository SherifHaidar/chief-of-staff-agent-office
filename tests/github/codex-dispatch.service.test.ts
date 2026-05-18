import { describe, expect, it, vi } from "vitest";

import type { GitHubAppClient } from "../../src/github/github-app-client.js";
import { CodexDispatchService } from "../../src/github/codex-dispatch.service.js";

const repository = "SherifHaidar/chief-of-staff-agent-office";

function createService(request = vi.fn()) {
  return new CodexDispatchService({ request } as unknown as GitHubAppClient, {
    allowedRepositories: [repository],
  });
}

describe("CodexDispatchService", () => {
  it("posts the exact @codex dispatch comment to the PR conversation", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      body: "@codex implement this work order on this PR branch.",
      created_at: "2026-05-18T10:00:00.000Z",
      html_url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22#issuecomment-1",
      id: 1,
      user: { login: "sherif-agent-office-orchestrator[bot]" },
    });
    const service = createService(request);

    const comment = await service.postDispatchComment({
      body: "@codex implement this work order on this PR branch.",
      pullRequestNumber: 22,
      repository,
    });

    expect(comment).toMatchObject({
      author: "sherif-agent-office-orchestrator[bot]",
      id: 1,
      url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22#issuecomment-1",
    });
    expect(request).toHaveBeenCalledWith({
      body: { body: "@codex implement this work order on this PR branch." },
      method: "POST",
      path: "/repos/SherifHaidar/chief-of-staff-agent-office/issues/22/comments",
    });
  });

  it("reports awaiting when no Codex evidence appears after the dispatch comment", async () => {
    const request = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const service = createService(request);

    const status = await service.collectStatus(
      {
        dispatchCommentCreatedAt: "2026-05-18T10:00:00.000Z",
        dispatchCommentId: 1,
        pullRequestNumber: 22,
        repository,
        taskId: "364b258f-9a3e-8199-9d57-f6b8d01a099a",
      },
      new Date("2026-05-18T10:05:00.000Z"),
    );

    expect(status).toMatchObject({
      label: "awaiting Codex response",
      signals: [],
    });
  });

  it("detects Codex review, task, and later PR commit evidence after the dispatch comment", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          body: "### Codex Review\n\nLooks good.",
          html_url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22#pullrequestreview-1",
          submitted_at: "2026-05-18T10:02:00.000Z",
          user: { login: "chatgpt-codex-connector[bot]" },
        },
      ])
      .mockResolvedValueOnce([
        {
          body: "Summary\n\n[View task ->](https://chatgpt.com/s/task)",
          created_at: "2026-05-18T10:03:00.000Z",
          html_url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/22#discussion_r1",
          user: { login: "chatgpt-codex-connector[bot]" },
        },
      ])
      .mockResolvedValueOnce([
        {
          commit: {
            author: { date: "2026-05-18T10:04:00.000Z", name: "SherifHaidar" },
            message: "Apply Codex dispatch update",
          },
          html_url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/commit/abc",
          sha: "abcdef123456",
        },
      ]);
    const service = createService(request);

    const status = await service.collectStatus(
      {
        dispatchCommentCreatedAt: "2026-05-18T10:00:00.000Z",
        dispatchCommentId: 1,
        pullRequestNumber: 22,
        repository,
        taskId: "364b258f-9a3e-8199-9d57-f6b8d01a099a",
      },
      new Date("2026-05-18T10:05:00.000Z"),
    );

    expect(status.label).toBe("Codex pushed/applied commits");
    expect(status.signals.map((signal) => signal.type)).toEqual(["codex_review", "codex_task", "commit"]);
  });
});

