import { describe, expect, it, vi } from "vitest";

import type { AiBuildTask } from "../../src/domain/ai-build-task.js";
import type { GitHubAppClient } from "../../src/github/github-app-client.js";
import { ProductRepoContextService } from "../../src/github/product-repo-context.service.js";

const task: AiBuildTask = {
  contentMarkdown: "Fix Quick Task routing in `app/api/process-capture/guards.ts` without touching unrelated UI.",
  pageId: "11111111-1111-1111-1111-111111111111",
  properties: {},
  title: "Fix Quick Task routing",
};

function blob(content: string) {
  return {
    content: Buffer.from(content, "utf8").toString("base64"),
    encoding: "base64",
  };
}

function createClient(request = vi.fn()) {
  return { request } as unknown as GitHubAppClient;
}

describe("ProductRepoContextService", () => {
  it("selects default and mentioned repo files within the configured cap", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ object: { sha: "base-sha" } })
      .mockResolvedValueOnce({
        truncated: false,
        tree: [
          { path: "README.md", sha: "readme-sha", type: "blob" },
          { path: "package.json", sha: "package-sha", type: "blob" },
          { path: "app/api/process-capture/guards.ts", sha: "guards-sha", type: "blob" },
          { path: "app/page.tsx", sha: "page-sha", type: "blob" },
        ],
      })
      .mockResolvedValueOnce(blob("# Daily Capture"))
      .mockResolvedValueOnce(blob('{"scripts":{"build":"next build"}}'))
      .mockResolvedValueOnce(blob("export function guard() {}"));
    const service = new ProductRepoContextService(createClient(request), {
      defaultBranch: "main",
      maxFileChars: 1000,
      maxFiles: 3,
    });

    const context = await service.fetchRepositoryContext({
      productContextMarkdown: "Important file: `app/api/process-capture/guards.ts`.",
      repository: "SherifHaidar/personal-chief-of-staff",
      task,
    });

    expect(context).toMatchObject({
      baseBranch: "main",
      baseCommitSha: "base-sha",
      totalFiles: 4,
      truncatedTree: false,
    });
    expect(context.files.map((file) => file.path)).toEqual([
      "README.md",
      "package.json",
      "app/api/process-capture/guards.ts",
    ]);
    expect(context.contextGaps).toContain("Repo context hit the 3 file cap; Codex should inspect additional files if needed.");
  });

  it("reports mentioned paths that are missing from the base branch", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ object: { sha: "base-sha" } })
      .mockResolvedValueOnce({
        truncated: false,
        tree: [{ path: "README.md", sha: "readme-sha", type: "blob" }],
      })
      .mockResolvedValueOnce(blob("# Daily Capture"));
    const service = new ProductRepoContextService(createClient(request), {
      defaultBranch: "main",
      maxFileChars: 1000,
      maxFiles: 5,
    });

    const context = await service.fetchRepositoryContext({
      productContextMarkdown: "Missing file: `lib/notion/matching.ts`.",
      repository: "SherifHaidar/personal-chief-of-staff",
      task,
    });

    expect(context.files.map((file) => file.path)).toEqual(["README.md"]);
    expect(context.contextGaps[0]).toContain("lib/notion/matching.ts");
  });
});
