import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ProductContextFile } from "../domain/product-context-pack.js";
import type { ProductContextRepoReader, ProductRepositoryContext } from "../context/product-context-pack.builder.js";
import { GitHubApiError, type GitHubAppClient } from "./github-app-client.js";

const DEFAULT_PRODUCT_CONTEXT_PATHS = [
  "README.md",
  "package.json",
  ".env.example",
  "app/page.tsx",
  "app/api/process-capture/route.ts",
  "app/api/process-capture/prompt.ts",
  "app/api/process-capture/guards.ts",
  "app/api/notion/sync-capture/route.ts",
  "app/api/notion/create-project/route.ts",
  "app/api/transcribe/route.ts",
  "lib/capture-schema.ts",
  "lib/notion.ts",
  "lib/notion/client.ts",
  "lib/notion/dates.ts",
  "lib/notion/preview.ts",
  "lib/notion/matching.ts",
  "lib/memory.ts",
  "lib/operating-manual.ts",
];

const STOP_WORDS = new Set([
  "about",
  "after",
  "agent",
  "build",
  "chief",
  "code",
  "codex",
  "context",
  "desk",
  "from",
  "handoff",
  "into",
  "notion",
  "office",
  "pack",
  "page",
  "product",
  "repo",
  "task",
  "that",
  "the",
  "this",
  "with",
]);

type TreeItem = {
  path?: string;
  sha?: string;
  size?: number;
  type?: string;
};

type TreeResponse = {
  tree?: TreeItem[];
  truncated?: boolean;
};

type RefResponse = {
  object?: {
    sha?: string;
  };
};

type BlobResponse = {
  content?: string;
  encoding?: string;
};

export type ProductRepoContextServiceConfig = {
  defaultBranch: string;
  maxFileChars: number;
  maxFiles: number;
  treeSampleLimit?: number;
};

function splitRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository "${repository}". Expected owner/name.`);
  }

  return { owner, repo };
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function extractMentionedPaths(value: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /`([^`]+\.(?:css|js|json|md|ts|tsx))`/g,
    /(?:^|\s)((?:app|lib|src|tests|docs|api)\/[A-Za-z0-9._/-]+\.(?:css|js|json|md|ts|tsx))/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) {
      const path = (match[1] ?? "").trim();
      if (path && !path.includes(" ")) {
        paths.add(path);
      }
    }
  }

  return [...paths];
}

function extractKeywords(task: AiBuildTask): string[] {
  const text = `${task.title}\n${task.contentMarkdown}`.toLowerCase();
  const words = text.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  return [...new Set(words.filter((word) => !STOP_WORDS.has(word)))].slice(0, 24);
}

function isLikelyUsefulFile(path: string): boolean {
  return /\.(css|js|json|md|ts|tsx)$/.test(path) && !path.includes("node_modules/") && !path.includes(".next/");
}

function scorePath(path: string, keywords: string[]): number {
  const lower = path.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += keyword.length;
    }
  }

  if (lower.endsWith(".md") || lower.endsWith(".json")) {
    score += 1;
  }

  return score;
}

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }

  return {
    text: `${value.slice(0, Math.max(0, maxChars - 100)).trimEnd()}\n\n[Truncated by Product Context Pack file budget.]`,
    truncated: true,
  };
}

function decodeBlob(blob: BlobResponse): string {
  if (blob.encoding !== "base64" || !blob.content) {
    return "";
  }

  return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values)];
}

export class ProductRepoContextService implements ProductContextRepoReader {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly config: ProductRepoContextServiceConfig,
  ) {}

  async fetchRepositoryContext(input: {
    productContextMarkdown?: string;
    repository: string;
    task: AiBuildTask;
  }): Promise<ProductRepositoryContext> {
    const { owner, repo } = splitRepository(input.repository);
    const baseBranch = this.config.defaultBranch;
    const ref = await this.client.request<RefResponse>({
      path: `/repos/${owner}/${repo}/git/ref/heads/${encodePath(baseBranch)}`,
    });
    const baseCommitSha = ref.object?.sha;
    const tree = await this.client.request<TreeResponse>({
      path: `/repos/${owner}/${repo}/git/trees/${encodePath(baseBranch)}`,
      query: { recursive: "1" },
    });
    const treeItems = (tree.tree ?? []).filter((item): item is Required<Pick<TreeItem, "path" | "sha" | "type">> & TreeItem =>
      item.type === "blob" && Boolean(item.path) && Boolean(item.sha),
    );
    const availablePaths = new Set(treeItems.map((item) => item.path));
    const contextGaps: string[] = [];
    const mentionedPaths = uniqueOrdered([
      ...extractMentionedPaths(input.productContextMarkdown ?? ""),
      ...extractMentionedPaths(input.task.contentMarkdown),
    ]);
    const missingMentionedPaths = mentionedPaths.filter((path) => !availablePaths.has(path));

    if (missingMentionedPaths.length > 0) {
      contextGaps.push(`Mentioned repo paths were not found on ${baseBranch}: ${missingMentionedPaths.slice(0, 8).join(", ")}.`);
    }

    const keywords = extractKeywords(input.task);
    const scoredPaths = treeItems
      .filter((item) => isLikelyUsefulFile(item.path))
      .map((item) => ({ path: item.path, score: scorePath(item.path, keywords) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.path);

    const essentialDefaultPaths = ["README.md", "package.json", ".env.example"].filter((path) => availablePaths.has(path));
    const remainingDefaultPaths = DEFAULT_PRODUCT_CONTEXT_PATHS.filter(
      (path) => availablePaths.has(path) && !essentialDefaultPaths.includes(path),
    );
    const candidatePaths = uniqueOrdered([
      ...essentialDefaultPaths,
      ...mentionedPaths.filter((path) => availablePaths.has(path)),
      ...remainingDefaultPaths,
      ...scoredPaths,
    ]).slice(0, this.config.maxFiles);

    if (candidatePaths.length === this.config.maxFiles) {
      contextGaps.push(`Repo context hit the ${this.config.maxFiles} file cap; Codex should inspect additional files if needed.`);
    }

    const files: ProductContextFile[] = [];
    for (const path of candidatePaths) {
      const treeItem = treeItems.find((item) => item.path === path);
      if (!treeItem) {
        continue;
      }

      try {
        const blob = await this.client.request<BlobResponse>({
          path: `/repos/${owner}/${repo}/git/blobs/${treeItem.sha}`,
        });
        const content = truncateText(decodeBlob(blob), this.config.maxFileChars);
        files.push({
          chars: content.text.length,
          content: content.text,
          path,
          reason: mentionedPaths.includes(path) ? "mentioned in task/product context" : "default or keyword-relevant context",
          truncated: content.truncated,
        });
      } catch (error) {
        if (error instanceof GitHubApiError && error.statusCode === 404) {
          contextGaps.push(`Could not fetch repo file ${path}: not found.`);
          continue;
        }

        throw error;
      }
    }

    return {
      baseBranch,
      ...(baseCommitSha ? { baseCommitSha } : {}),
      contextGaps,
      files,
      fileTreeSample: treeItems.map((item) => item.path).filter(isLikelyUsefulFile).slice(0, this.config.treeSampleLimit ?? 80),
      totalFiles: treeItems.length,
      truncatedTree: Boolean(tree.truncated),
    };
  }
}
