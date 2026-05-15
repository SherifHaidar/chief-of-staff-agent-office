import { describe, expect, it, vi } from "vitest";

import { ProductContextPackBuilder } from "../../src/context/product-context-pack.builder.js";
import type { AiBuildTask } from "../../src/domain/ai-build-task.js";

const task: AiBuildTask = {
  contentMarkdown: "Improve Quick Task routing. Likely touches `app/api/process-capture/guards.ts`.",
  pageId: "11111111-1111-1111-1111-111111111111",
  properties: {},
  status: "Ready for Architecture",
  title: "Improve Quick Task routing",
};

describe("ProductContextPackBuilder", () => {
  it("combines bounded Notion and GitHub context into a shared pack", async () => {
    const notionReader = {
      fetchProductContextPage: vi.fn().mockResolvedValue({
        contentMarkdown: "Product purpose and do-not-break flows.",
        pageId: "361b258f-9a3e-819f-8cd9-f9e33d768e0a",
        title: "Agent Context - Chief of Staff Product",
        url: "https://notion.so/context",
      }),
    };
    const repoReader = {
      fetchRepositoryContext: vi.fn().mockResolvedValue({
        baseBranch: "main",
        baseCommitSha: "abc123",
        contextGaps: ["Repo file cap reached."],
        files: [
          {
            chars: 24,
            content: "export function guard() {}",
            path: "app/api/process-capture/guards.ts",
            reason: "mentioned in task/product context",
            truncated: false,
          },
        ],
        fileTreeSample: ["README.md", "app/api/process-capture/guards.ts"],
        totalFiles: 2,
        truncatedTree: false,
      }),
    };
    const builder = new ProductContextPackBuilder({
      config: {
        maxFileChars: 8000,
        maxFiles: 10,
        maxNotionChars: 16000,
        maxTotalChars: 32000,
        productContextPageId: "361b258f9a3e819f8cd9f9e33d768e0a",
      },
      notionReader,
      repoReader,
    });

    const pack = await builder.build({ targetProductRepo: "SherifHaidar/personal-chief-of-staff", task });

    expect(pack).toMatchObject({
      baseBranch: "main",
      baseCommitSha: "abc123",
      included: true,
      targetProductRepo: "SherifHaidar/personal-chief-of-staff",
    });
    expect(pack.notionContext?.title).toBe("Agent Context - Chief of Staff Product");
    expect(pack.repoContext?.files[0]?.path).toBe("app/api/process-capture/guards.ts");
    expect(pack.contextGaps).toContain("Repo file cap reached.");
    expect(repoReader.fetchRepositoryContext).toHaveBeenCalledWith({
      productContextMarkdown: "Product purpose and do-not-break flows.",
      repository: "SherifHaidar/personal-chief-of-staff",
      task,
    });
  });

  it("returns context gaps instead of throwing when one source is unavailable", async () => {
    const builder = new ProductContextPackBuilder({
      config: {
        maxFileChars: 8000,
        maxFiles: 10,
        maxNotionChars: 16000,
        maxTotalChars: 32000,
        productContextPageId: "361b258f9a3e819f8cd9f9e33d768e0a",
      },
      notionReader: {
        fetchProductContextPage: vi.fn().mockRejectedValue(new Error("Notion unavailable")),
      },
    });

    const pack = await builder.build({ targetProductRepo: "SherifHaidar/personal-chief-of-staff", task });

    expect(pack.included).toBe(false);
    expect(pack.contextGaps).toContain("Could not read Notion product context page: Notion unavailable");
    expect(pack.contextGaps).toContain("GitHub product repo context reader is not configured.");
  });
});
