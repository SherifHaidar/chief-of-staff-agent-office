import type { AiBuildTask } from "../domain/ai-build-task.js";
import type { ProductContextFile, ProductContextPack } from "../domain/product-context-pack.js";
import { normalizeNotionPageId } from "../utils/ids.js";

export type ProductContextPage = {
  contentMarkdown: string;
  pageId: string;
  title: string;
  url?: string;
};

export type ProductRepositoryContext = {
  baseBranch?: string;
  baseCommitSha?: string;
  contextGaps: string[];
  files: ProductContextFile[];
  fileTreeSample: string[];
  totalFiles: number;
  truncatedTree: boolean;
};

export type ProductContextNotionReader = {
  fetchProductContextPage(pageId: string): Promise<ProductContextPage>;
};

export type ProductContextRepoReader = {
  fetchRepositoryContext(input: {
    productContextMarkdown?: string;
    repository: string;
    task: AiBuildTask;
  }): Promise<ProductRepositoryContext>;
};

export type ProductContextPackBuilderConfig = {
  maxFileChars: number;
  maxFiles: number;
  maxNotionChars: number;
  maxTotalChars: number;
  productContextPageId?: string;
};

export type ProductContextProvider = {
  build(input: { targetProductRepo: string; task: AiBuildTask }): Promise<ProductContextPack>;
};

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }

  return {
    text: `${value.slice(0, Math.max(0, maxChars - 120)).trimEnd()}\n\n[Truncated by Product Context Pack budget.]`,
    truncated: true,
  };
}

function totalPackChars(pack: ProductContextPack): number {
  return (
    (pack.notionContext?.contentMarkdown.length ?? 0) +
    (pack.repoContext?.files.reduce((total, file) => total + file.content.length, 0) ?? 0)
  );
}

function trimPackToTotalBudget(pack: ProductContextPack): ProductContextPack {
  let totalChars = totalPackChars(pack);
  if (totalChars <= pack.budgets.maxTotalChars || !pack.repoContext) {
    return pack;
  }

  const files: ProductContextFile[] = [];
  for (const file of pack.repoContext.files) {
    if (totalChars <= pack.budgets.maxTotalChars) {
      files.push(file);
      continue;
    }

    const overage = totalChars - pack.budgets.maxTotalChars;
    const nextLength = Math.max(800, file.content.length - overage);
    const truncated = truncateText(file.content, nextLength);
    const nextFile = {
      ...file,
      chars: truncated.text.length,
      content: truncated.text,
      truncated: true,
    };
    totalChars = totalChars - file.content.length + nextFile.content.length;
    files.push(nextFile);
  }

  return {
    ...pack,
    contextGaps: [...pack.contextGaps, "Product Context Pack hit the total character budget; some repo excerpts were truncated."],
    repoContext: {
      ...pack.repoContext,
      files,
    },
  };
}

export class ProductContextPackBuilder implements ProductContextProvider {
  constructor(
    private readonly dependencies: {
      config: ProductContextPackBuilderConfig;
      notionReader?: ProductContextNotionReader;
      repoReader?: ProductContextRepoReader;
    },
  ) {}

  async build(input: { targetProductRepo: string; task: AiBuildTask }): Promise<ProductContextPack> {
    const generatedAt = new Date().toISOString();
    const contextGaps: string[] = [];
    const sources: ProductContextPack["sources"] = [];
    let notionContext: ProductContextPack["notionContext"];
    let repoContext: ProductRepositoryContext | undefined;
    let productContextMarkdown: string | undefined;

    if (!this.dependencies.config.productContextPageId) {
      contextGaps.push("PRODUCT_CONTEXT_PAGE_ID is not configured.");
    } else if (!this.dependencies.notionReader) {
      contextGaps.push("Product context Notion reader is not configured.");
    } else {
      try {
        const pageId = normalizeNotionPageId(this.dependencies.config.productContextPageId);
        const page = await this.dependencies.notionReader.fetchProductContextPage(pageId);
        const truncated = truncateText(page.contentMarkdown, this.dependencies.config.maxNotionChars);
        productContextMarkdown = truncated.text;
        notionContext = {
          chars: truncated.text.length,
          contentMarkdown: truncated.text,
          pageId: page.pageId,
          title: page.title,
          truncated: truncated.truncated,
          ...(page.url ? { url: page.url } : {}),
        };
        sources.push({
          chars: truncated.text.length,
          included: true,
          label: page.title,
          reference: page.url ?? page.pageId,
          type: "notion",
        });
        if (truncated.truncated) {
          contextGaps.push("Notion product context was truncated by the Product Context Pack budget.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Notion product context error.";
        contextGaps.push(`Could not read Notion product context page: ${message}`);
        sources.push({
          error: message,
          included: false,
          label: "Agent Context - Chief of Staff Product",
          reference: this.dependencies.config.productContextPageId,
          type: "notion",
        });
      }
    }

    if (!this.dependencies.repoReader) {
      contextGaps.push("GitHub product repo context reader is not configured.");
    } else {
      try {
        repoContext = await this.dependencies.repoReader.fetchRepositoryContext({
          productContextMarkdown,
          repository: input.targetProductRepo,
          task: input.task,
        });
        contextGaps.push(...repoContext.contextGaps);
        sources.push({
          chars: repoContext.files.reduce((total, file) => total + file.content.length, 0),
          included: repoContext.files.length > 0,
          label: input.targetProductRepo,
          reference: `${input.targetProductRepo}@${repoContext.baseCommitSha ?? repoContext.baseBranch ?? "unknown"}`,
          type: "github",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown GitHub product repo context error.";
        contextGaps.push(`Could not read GitHub product repo context: ${message}`);
        sources.push({
          error: message,
          included: false,
          label: input.targetProductRepo,
          reference: input.targetProductRepo,
          type: "github",
        });
      }
    }

    const pack: ProductContextPack = {
      ...(repoContext?.baseBranch ? { baseBranch: repoContext.baseBranch } : {}),
      ...(repoContext?.baseCommitSha ? { baseCommitSha: repoContext.baseCommitSha } : {}),
      budgets: {
        maxFileChars: this.dependencies.config.maxFileChars,
        maxFiles: this.dependencies.config.maxFiles,
        maxNotionChars: this.dependencies.config.maxNotionChars,
        maxTotalChars: this.dependencies.config.maxTotalChars,
      },
      contextGaps,
      generatedAt,
      included: Boolean(notionContext || (repoContext && repoContext.files.length > 0)),
      ...(notionContext ? { notionContext } : {}),
      ...(repoContext
        ? {
            repoContext: {
              files: repoContext.files,
              fileTreeSample: repoContext.fileTreeSample,
              totalFiles: repoContext.totalFiles,
              truncatedTree: repoContext.truncatedTree,
            },
          }
        : {}),
      sources,
      targetProductRepo: input.targetProductRepo,
    };

    return trimPackToTotalBudget(pack);
  }
}
