import type { ArchitectBrief } from "../domain/architect-brief.js";
import type { SerializedError } from "../utils/errors.js";

export type WorkflowSuccess = {
  brief: ArchitectBrief;
  dryRun: boolean;
  ok: true;
  pageId: string;
  statusUpdated: boolean;
  title: string;
  wroteToNotion: boolean;
};

export type WorkflowFailure = {
  error: SerializedError;
  ok: false;
  pageId?: string;
};

export type WorkflowResult = WorkflowFailure | WorkflowSuccess;
