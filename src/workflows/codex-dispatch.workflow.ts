import type { AiBuildTask } from "../domain/ai-build-task.js";
import type {
  CodexDispatchInput,
  CodexDispatchPreview,
  CodexDispatchRecordResult,
  CodexDispatchResult,
} from "../domain/codex-dispatch.js";
import {
  countCodexDispatchMarker,
  createCodexDispatchPlan,
  createCodexDispatchPreview,
  createCodexDispatchRecordResult,
} from "../domain/codex-dispatch.js";
import type { CodexDispatchService } from "../github/codex-dispatch.service.js";
import { serializeError } from "../utils/errors.js";
import { normalizeNotionPageId } from "../utils/ids.js";
import type { Logger } from "../utils/logger.js";
import { silentLogger } from "../utils/logger.js";

export type CodexDispatchTaskRepository = {
  appendCodexDispatchResult(pageId: string, result: CodexDispatchRecordResult, generatedAt: Date): Promise<void>;
  fetchTask(pageId: string): Promise<AiBuildTask>;
};

export type CodexDispatchRecordInput = {
  preview: CodexDispatchPreview;
};

export type CodexDispatchWorkflowSuccess = {
  dispatch: CodexDispatchResult;
  dryRun: boolean;
  ok: true;
  pageId: string;
  statusUpdated: false;
  title: string;
  wroteToNotion: boolean;
};

export type CodexDispatchWorkflowFailure = {
  error: ReturnType<typeof serializeError>;
  ok: false;
  pageId?: string;
};

export type CodexDispatchWorkflowResult = CodexDispatchWorkflowFailure | CodexDispatchWorkflowSuccess;

export type CodexDispatchWorkflowDependencies = {
  dispatchService: CodexDispatchService;
  logger?: Logger;
  now?: () => Date;
  taskRepository: CodexDispatchTaskRepository;
};

export class CodexDispatchWorkflow {
  private readonly dispatchService: CodexDispatchService;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly taskRepository: CodexDispatchTaskRepository;

  constructor(dependencies: CodexDispatchWorkflowDependencies) {
    this.dispatchService = dependencies.dispatchService;
    this.logger = dependencies.logger ?? silentLogger;
    this.now = dependencies.now ?? (() => new Date());
    this.taskRepository = dependencies.taskRepository;
  }

  async preview(input: CodexDispatchInput): Promise<CodexDispatchWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.taskId);
      const normalizedInput = { ...input, taskId: pageId };
      const generatedAt = this.now();

      this.logger.info("Preparing Codex Dispatch packet preview", {
        pageId,
        pullRequestNumber: input.pullRequestNumber,
        repository: input.repository,
      });

      const evidence = await this.dispatchService.collectEvidence(normalizedInput, generatedAt);
      const task = await this.taskRepository.fetchTask(pageId);
      const { packet, plan } = createCodexDispatchPlan({
        evidence,
        request: normalizedInput,
        task,
      });
      const preview = createCodexDispatchPreview({
        evidence,
        generatedAt,
        packet,
        plan,
        request: normalizedInput,
        task,
      });

      return {
        dispatch: preview,
        dryRun: true,
        ok: true,
        pageId,
        statusUpdated: false,
        title: preview.packet.title,
        wroteToNotion: false,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Codex Dispatch preview failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }

  async record(input: CodexDispatchRecordInput): Promise<CodexDispatchWorkflowResult> {
    let pageId: string | undefined;

    try {
      pageId = normalizeNotionPageId(input.preview.input.taskId);
      const generatedAt = this.now();
      const task = await this.taskRepository.fetchTask(pageId);
      const duplicateMarkerCount = countCodexDispatchMarker(task.contentMarkdown, input.preview.plan.dispatchMarker);

      if (duplicateMarkerCount > 1) {
        throw Object.assign(
          new Error(
            `Codex Dispatch marker ${input.preview.plan.dispatchMarker} appears ${duplicateMarkerCount} times. Resolve duplicate dispatch records before recording.`,
          ),
          { statusCode: 409 },
        );
      }

      this.logger.info("Recording Codex Dispatch packet to Notion", {
        pageId,
        pullRequestNumber: input.preview.input.pullRequestNumber,
        repository: input.preview.input.repository,
      });

      const markerAlreadyExists = duplicateMarkerCount > 0;
      const recordResult = createCodexDispatchRecordResult({
        blockAppended: !markerAlreadyExists,
        duplicateMarkerCount,
        generatedAt,
        markerAlreadyExists,
        preview: input.preview,
      });

      if (!markerAlreadyExists) {
        await this.taskRepository.appendCodexDispatchResult(pageId, recordResult, generatedAt);
      }

      return {
        dispatch: recordResult,
        dryRun: false,
        ok: true,
        pageId,
        statusUpdated: false,
        title: recordResult.packet.title,
        wroteToNotion: !markerAlreadyExists,
      };
    } catch (error) {
      const serialized = serializeError(error);
      this.logger.error("Codex Dispatch record failed", { error: serialized.message, pageId });

      return {
        error: serialized,
        ok: false,
        pageId,
      };
    }
  }
}
