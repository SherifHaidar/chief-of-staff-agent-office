export type ProductContextSourceType = "github" | "notion";

export type ProductContextSource = {
  chars?: number;
  error?: string;
  included: boolean;
  label: string;
  reference: string;
  type: ProductContextSourceType;
};

export type ProductContextFile = {
  chars: number;
  content: string;
  path: string;
  reason: string;
  truncated: boolean;
};

export type ProductContextPack = {
  baseBranch?: string;
  baseCommitSha?: string;
  budgets: {
    maxFileChars: number;
    maxFiles: number;
    maxNotionChars: number;
    maxTotalChars: number;
  };
  contextGaps: string[];
  generatedAt: string;
  included: boolean;
  notionContext?: {
    chars: number;
    contentMarkdown: string;
    pageId: string;
    title: string;
    truncated: boolean;
    url?: string;
  };
  repoContext?: {
    files: ProductContextFile[];
    fileTreeSample: string[];
    totalFiles: number;
    truncatedTree: boolean;
  };
  sources: ProductContextSource[];
  targetProductRepo: string;
};

export type ProductContextPackSummary = {
  baseBranch?: string;
  baseCommitSha?: string;
  contextGaps: string[];
  fileCount: number;
  included: boolean;
  notionIncluded: boolean;
  repoIncluded: boolean;
  sources: ProductContextSource[];
  targetProductRepo: string;
};

export function summarizeProductContextPack(pack?: ProductContextPack): ProductContextPackSummary | undefined {
  if (!pack) {
    return undefined;
  }

  return {
    ...(pack.baseBranch ? { baseBranch: pack.baseBranch } : {}),
    ...(pack.baseCommitSha ? { baseCommitSha: pack.baseCommitSha } : {}),
    contextGaps: pack.contextGaps,
    fileCount: pack.repoContext?.files.length ?? 0,
    included: pack.included,
    notionIncluded: Boolean(pack.notionContext),
    repoIncluded: Boolean(pack.repoContext && pack.repoContext.files.length > 0),
    sources: pack.sources,
    targetProductRepo: pack.targetProductRepo,
  };
}

export function formatProductContextPackForAgent(pack?: ProductContextPack): string {
  if (!pack || !pack.included) {
    return "Product Context Pack: not available. Call out this context gap instead of guessing.";
  }

  const sections = [
    "Product Context Pack:",
    JSON.stringify(
      {
        baseBranch: pack.baseBranch ?? null,
        baseCommitSha: pack.baseCommitSha ?? null,
        budgets: pack.budgets,
        contextGaps: pack.contextGaps,
        generatedAt: pack.generatedAt,
        sources: pack.sources.map((source) => ({
          error: source.error ?? null,
          included: source.included,
          label: source.label,
          reference: source.reference,
          type: source.type,
        })),
        targetProductRepo: pack.targetProductRepo,
      },
      null,
      2,
    ),
  ];

  if (pack.notionContext) {
    sections.push(
      [
        "Notion product context:",
        `Title: ${pack.notionContext.title}`,
        `Page: ${pack.notionContext.url ?? pack.notionContext.pageId}`,
        pack.notionContext.contentMarkdown,
      ].join("\n"),
    );
  }

  if (pack.repoContext) {
    sections.push(
      [
        "Repository context:",
        `Files inspected: ${pack.repoContext.files.map((file) => file.path).join(", ") || "none"}`,
        `Tree sample: ${pack.repoContext.fileTreeSample.join(", ")}`,
        ...pack.repoContext.files.map((file) =>
          [
            `--- ${file.path} (${file.reason}${file.truncated ? ", truncated" : ""}) ---`,
            file.content || "No content returned.",
          ].join("\n"),
        ),
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}
