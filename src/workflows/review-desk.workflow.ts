import type { AiBuildTask } from "../domain/ai-build-task.js";
import {
  REVIEW_DESK_FINAL_APPROVAL_WARNING,
  type ClaudeReviewPacket,
  type ReviewDeskEvidencePacket,
  type ReviewDeskInput,
  type ReviewDeskResult,
} from "../domain/review-desk.js";
import {
  applyReviewDeskPostGates,
  createBlockedReview,
  evaluateReviewDeskEvidence,
  hasBlockingFindings,
} from "../domain/review-desk-policy.js";
import type { ReviewDeskService } from "../github/review-desk.service.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";
import type { ClaudeReviewRunner } from "../agents/claude-review.agent.js";

export type ReviewDeskTaskRepository = {
  appendReviewDeskResult(pageId: string, result: ReviewDeskResult, generatedAt: Date): Promise<void>;
  fetchTask(pageId: string): Promise<AiBuildTask>;
};

export type ReviewDeskWorkflowSuccess = {
  dryRun: false;
  ok: true;
  pageId: string;
  result: ReviewDeskResult;
  statusUpdated: false;
  title: string;
  wroteToNotion: boolean;
};

export type ReviewDeskWorkflowFailure = {
  error: ReturnType<typeof serializeError>;
  ok: false;
  pageId?: string;
};

export type ReviewDeskWorkflowResult = ReviewDeskWorkflowFailure | ReviewDeskWorkflowSuccess;

export type ReviewDeskWorkflowDependencies = {
  logger?: Logger;
  now?: () => Date;
  reviewDeskService: ReviewDeskService;
  reviewer: ClaudeReviewRunner;
  taskRepository: ReviewDeskTaskRepository;
};

function extractMarkdownListSection(markdown: string, headingTitle: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^#{1,3}\\s+${headingTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (headingPattern.test(line.trim())) {
      inSection = true;
      continue;
    }

    if (inSection && /^#{1,3}\s+/.test(line.trim())) {
      break;
    }

    if (!inSection) {
      continue;
    }

    const match = line.trim().match(/^[-*]\s+(.+)$/);
    if (match?.[1]) {
      items.push(match[1].trim());
    }
  }

  return items;
}

function extractAcceptanceCriteria(task: AiBuildTask, prWorkOrderMarkdown?: string): string[] {
  const fromWorkOrder = extractMarkdownListSection(prWorkOrderMarkdown ?? "", "Acceptance Checklist");
  if (fromWorkOrder.length > 0) {
    return fromWorkOrder;
  }

  return extractMarkdownListSection(task.contentMarkdown, "Acceptance Checklist");
}

function createEvidencePacket(input: {
  collectedAt: Date;
  input: ReviewDeskInput;
  prWorkOrderMarkdown?: string;
  prWorkOrderPath?: string;
  pullRequest: ReviewDeskEvidencePacket["pullRequest"];
  task: AiBuildTask;
  workOrderWarning?: string;
}): ReviewDeskEvidencePacket {
  const missingEvidence = input.workOrderWarning ? [input.workOrderWarning] : [];
  const evidence: ReviewDeskEvidencePacket = {
    collectedAt: input.collectedAt.toISOString(),
    input: input.input,
    missingEvidence,
    policyFindings: [],
    pullRequest: input.pullRequest,
    workOrder: {
      acceptanceCriteria: extractAcceptanceCriteria(input.task, input.prWorkOrderMarkdown),
      contentMarkdown: input.task.contentMarkdown,
      pageTitle: input.task.title,
      ...(input.prWorkOrderMarkdown ? { prWorkOrderMarkdown: input.prWorkOrderMarkdown } : {}),
      ...(input.prWorkOrderPath ? { prWorkOrderPath: input.prWorkOrderPath } : {}),
      ...(input.task.status ? { status: input.task.status } : {}),
      taskId: input.task.pageId,
      ...(input.task.url ? { url: input.task.url } : {}),
    },
  };
  const findings = evaluateReviewDeskEvidence(evidence);

  return {
    ...evidence,
    missingEvidence: Array.from(
      new Set([
        ...evidence.missingEvidence,
        ...findings.filter((finding) => finding.severity === "missing_evidence").map((finding) => finding.message),
      ]),
    ),
    policyFindings: findings,
  };
}

function createInvalidClaudeReview(input: { error: unknown; evidence: ReviewDeskEvidencePacket }): ClaudeReviewPacket {
  const message = serializeError(input.error).message;
  const isConfigurationError =
    message.includes("CLAUDE_REVIEW_MODEL") ||
    message.includes("Claude review model is unavailable") ||
    message.includes("HTTP 401") ||
    message.includes("HTTP 403");

  return {
    acceptanceChecklist: input.evidence.workOrder.acceptanceCriteria.map((criterion) => ({
      criterion,
      notes: "Not evaluated because Claude returned invalid or unavailable structured output.",
      status: "unclear",
    })),
    missingEvidence: [`Claude structured review failed: ${message}`],
    risks: [
      isConfigurationError
        ? "Review could not run because Claude review configuration was unavailable or rejected."
        : "Review could not trust model output because it was invalid or unavailable.",
    ],
    suggestedSmokeTests: [],
    summary: isConfigurationError
      ? "Review blocked because Claude review configuration is invalid or unavailable."
      : "Review blocked because Claude structured review did not produce valid output.",
    verdict: "Blocked",
  };
}

export class ReviewDeskWorkflow {
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly reviewDeskService: ReviewDeskService;
  private readonly reviewer: ClaudeReviewRunner;
  private readonly taskRepository: ReviewDeskTaskRepository;

  constructor(dependencies: ReviewDeskWorkflowDependencies) {
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.reviewDeskService = dependencies.reviewDeskService;
    this.reviewer = dependencies.reviewer;
    this.taskRepository = dependencies.taskRepository;
  }

  async run(input: ReviewDeskInput): Promise<ReviewDeskWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.taskId);
      const normalizedInput = { ...input, taskId: pageId };
      this.logger.info("Running Review + Iteration Desk", {
        pageId,
        pullRequestNumber: input.pullRequestNumber,
        repository: input.repository,
      });

      const task = await this.taskRepository.fetchTask(pageId);
      const pullRequest = await this.reviewDeskService.collectPullRequestEvidence(normalizedInput);
      const prWorkOrder = await this.reviewDeskService.fetchWorkOrderFromPullRequest({
        body: pullRequest.body,
        headBranch: pullRequest.headBranch,
        repository: pullRequest.repository,
      });
      const evidence = createEvidencePacket({
        collectedAt: this.now(),
        input: normalizedInput,
        prWorkOrderMarkdown: prWorkOrder.markdown,
        prWorkOrderPath: prWorkOrder.path,
        pullRequest,
        task,
        workOrderWarning: prWorkOrder.warning,
      });
      const review = hasBlockingFindings(evidence.policyFindings)
        ? createBlockedReview({ evidence, findings: evidence.policyFindings })
        : applyReviewDeskPostGates({
            evidence,
            findings: evidence.policyFindings,
            review: await this.runClaudeReview(evidence),
          });
      const result: ReviewDeskResult = {
        evidence,
        finalApprovalWarning: REVIEW_DESK_FINAL_APPROVAL_WARNING,
        review,
      };

      await this.taskRepository.appendReviewDeskResult(pageId, result, this.now());

      return {
        dryRun: false,
        ok: true,
        pageId,
        result,
        statusUpdated: false,
        title: `Review Desk: ${pullRequest.repository}#${pullRequest.pullRequestNumber}`,
        wroteToNotion: true,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Review + Iteration Desk failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }

  private async runClaudeReview(evidence: ReviewDeskEvidencePacket): Promise<ClaudeReviewPacket> {
    try {
      return await this.reviewer.review(evidence);
    } catch (error) {
      return createInvalidClaudeReview({ error, evidence });
    }
  }
}
