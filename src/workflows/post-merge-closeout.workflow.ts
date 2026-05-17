import type { AiBuildTask } from "../domain/ai-build-task.js";
import type {
  PostMergeCloseoutCommitResult,
  PostMergeCloseoutEvidence,
  PostMergeCloseoutInput,
  PostMergeCloseoutPlan,
  PostMergeCloseoutPreview,
  PostMergeCloseoutPropertyWrite,
  PostMergeCloseoutResult,
} from "../domain/post-merge-closeout.js";
import {
  createPostMergeCloseoutCommitResult,
  createPostMergeCloseoutPreview,
} from "../domain/post-merge-closeout.js";
import type { PostMergeCloseoutService } from "../github/post-merge-closeout.service.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";

export type PostMergeCloseoutTaskRepository = {
  appendPostMergeCloseoutResult(pageId: string, result: PostMergeCloseoutResult, generatedAt: Date): Promise<void>;
  createPostMergeCloseoutPlan(input: {
    evidence: PostMergeCloseoutEvidence;
    mergedStatusName: string;
    task: AiBuildTask;
  }): PostMergeCloseoutPlan;
  fetchTask(pageId: string): Promise<AiBuildTask>;
  writePostMergeCloseoutProperties(pageId: string, plan: PostMergeCloseoutPlan): Promise<PostMergeCloseoutPropertyWrite[]>;
};

export type PostMergeCloseoutWorkflowSuccess = {
  dryRun: boolean;
  ok: true;
  pageId: string;
  result: PostMergeCloseoutResult;
  statusUpdated: boolean;
  title: string;
  wroteToNotion: boolean;
};

export type PostMergeCloseoutWorkflowFailure = {
  error: ReturnType<typeof serializeError>;
  ok: false;
  pageId?: string;
};

export type PostMergeCloseoutWorkflowResult = PostMergeCloseoutWorkflowFailure | PostMergeCloseoutWorkflowSuccess;

export type PostMergeCloseoutWorkflowDependencies = {
  closeoutService: PostMergeCloseoutService;
  logger?: Logger;
  mergedStatusName: string;
  now?: () => Date;
  taskRepository: PostMergeCloseoutTaskRepository;
};

export class PostMergeCloseoutWorkflow {
  private readonly closeoutService: PostMergeCloseoutService;
  private readonly logger: Logger;
  private readonly mergedStatusName: string;
  private readonly now: () => Date;
  private readonly taskRepository: PostMergeCloseoutTaskRepository;

  constructor(dependencies: PostMergeCloseoutWorkflowDependencies) {
    this.closeoutService = dependencies.closeoutService;
    this.logger = dependencies.logger ?? silentLogger;
    this.mergedStatusName = dependencies.mergedStatusName;
    this.now = dependencies.now ?? (() => new Date());
    this.taskRepository = dependencies.taskRepository;
  }

  async preview(input: PostMergeCloseoutInput): Promise<PostMergeCloseoutWorkflowResult> {
    return this.run(input, "preview");
  }

  async commit(input: PostMergeCloseoutInput): Promise<PostMergeCloseoutWorkflowResult> {
    return this.run(input, "commit");
  }

  private async run(input: PostMergeCloseoutInput, mode: "commit" | "preview"): Promise<PostMergeCloseoutWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.taskId);
      const normalizedInput = { ...input, taskId: pageId };
      this.logger.info("Running Post-Merge Closeout", {
        mode,
        pageId,
        pullRequestNumber: input.pullRequestNumber,
        repository: input.repository,
      });

      const generatedAt = this.now();
      const evidence = await this.closeoutService.collectEvidence(normalizedInput, generatedAt);
      const task = await this.taskRepository.fetchTask(pageId);
      const plan = this.taskRepository.createPostMergeCloseoutPlan({
        evidence,
        mergedStatusName: this.mergedStatusName,
        task,
      });

      if (plan.duplicateMarkerCount > 1) {
        throw Object.assign(
          new Error(
            `Post-Merge Closeout marker ${plan.closeoutMarker} appears ${plan.duplicateMarkerCount} times. Resolve duplicate closeout records before committing.`,
          ),
          { statusCode: 409 },
        );
      }

      if (mode === "preview") {
        const preview = createPostMergeCloseoutPreview({
          evidence,
          generatedAt,
          plan,
          request: normalizedInput,
          task,
        });

        return {
          dryRun: true,
          ok: true,
          pageId,
          result: preview,
          statusUpdated: false,
          title: `Post-Merge Closeout: ${evidence.pullRequest.repository}#${evidence.pullRequest.pullRequestNumber}`,
          wroteToNotion: false,
        };
      }

      const propertyWrites = await this.taskRepository.writePostMergeCloseoutProperties(pageId, plan);
      const commitResult = createPostMergeCloseoutCommitResult({
        blockAppended: !plan.markerAlreadyExists,
        evidence,
        generatedAt,
        plan,
        propertyWrites,
        request: normalizedInput,
        task,
      });

      if (!plan.markerAlreadyExists) {
        await this.taskRepository.appendPostMergeCloseoutResult(pageId, commitResult, generatedAt);
      }

      return {
        dryRun: false,
        ok: true,
        pageId,
        result: commitResult,
        statusUpdated: propertyWrites.some(
          (write) => write.source === "Status after post-merge closeout" && write.status === "written",
        ),
        title: `Post-Merge Closeout: ${evidence.pullRequest.repository}#${evidence.pullRequest.pullRequestNumber}`,
        wroteToNotion: true,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Post-Merge Closeout failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
