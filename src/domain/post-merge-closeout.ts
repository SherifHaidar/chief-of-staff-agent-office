import { z } from "zod";

import type { AiBuildTask } from "./ai-build-task.js";
import type { NotionStatusPropertyType } from "../notion/notion-types.js";

export const PostMergeCloseoutInputSchema = z
  .object({
    pullRequestNumber: z.number().int().positive(),
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repository must be owner/name"),
    taskId: z.string().trim().min(1),
  })
  .strict();

export type PostMergeCloseoutInput = z.infer<typeof PostMergeCloseoutInputSchema>;

export const PostMergeCloseoutCheckSchema = z
  .object({
    completedAt: z.string().optional(),
    conclusion: z.string().nullable().optional(),
    detailsUrl: z.string().url().optional(),
    name: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

export type PostMergeCloseoutCheck = z.infer<typeof PostMergeCloseoutCheckSchema>;

export const PostMergeCloseoutDeploymentEvidenceSchema = z
  .object({
    deployments: z
      .array(
        z
          .object({
            environment: z.string().optional(),
            state: z.string().optional(),
            statuses: z.array(PostMergeCloseoutCheckSchema).default([]),
            url: z.string().url().optional(),
          })
          .strict(),
      )
      .default([]),
    message: z.string().optional(),
    status: z.enum(["found", "missing", "unavailable"]),
  })
  .strict();

export type PostMergeCloseoutDeploymentEvidence = z.infer<typeof PostMergeCloseoutDeploymentEvidenceSchema>;

export const PostMergeCloseoutPullRequestEvidenceSchema = z
  .object({
    baseBranch: z.string().min(1),
    headBranch: z.string().min(1),
    headSha: z.string().optional(),
    mergeSha: z.string().min(1),
    merged: z.literal(true),
    mergedAt: z.string().min(1),
    mergedBy: z.string().optional(),
    pullRequestNumber: z.number().int().positive(),
    repository: z.string().min(1),
    state: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

export type PostMergeCloseoutPullRequestEvidence = z.infer<typeof PostMergeCloseoutPullRequestEvidenceSchema>;

export const PostMergeCloseoutEvidenceSchema = z
  .object({
    collectedAt: z.string().datetime(),
    deployment: PostMergeCloseoutDeploymentEvidenceSchema,
    pullRequest: PostMergeCloseoutPullRequestEvidenceSchema,
  })
  .strict();

export type PostMergeCloseoutEvidence = z.infer<typeof PostMergeCloseoutEvidenceSchema>;

export type PostMergeCloseoutPropertyWriteStatus = "planned" | "skipped" | "written";

export type PostMergeCloseoutPropertyWrite = {
  name: string;
  reason?: string;
  source: string;
  status: PostMergeCloseoutPropertyWriteStatus;
  type?: string;
  update?: Record<string, unknown>;
  value?: string | number;
};

export type PostMergeCloseoutPlan = {
  blockPreview: string;
  closeoutMarker: string;
  duplicateMarkerCount: number;
  markerAlreadyExists: boolean;
  propertyWrites: PostMergeCloseoutPropertyWrite[];
};

export type PostMergeCloseoutDiagnostics = {
  deploymentLookup: string;
  githubVerification: string;
  idempotency: string;
  notionTaskTarget: string;
  properties: string[];
};

export type PostMergeCloseoutPreview = {
  committed: false;
  diagnostics: PostMergeCloseoutDiagnostics;
  evidence: PostMergeCloseoutEvidence;
  generatedAt: string;
  input: PostMergeCloseoutInput;
  notionTask: {
    currentStatus?: string;
    pageId: string;
    title: string;
    url?: string;
  };
  plan: PostMergeCloseoutPlan;
};

export type PostMergeCloseoutCommitResult = {
  blockAppended: boolean;
  committed: true;
  diagnostics: PostMergeCloseoutDiagnostics;
  evidence: PostMergeCloseoutEvidence;
  generatedAt: string;
  input: PostMergeCloseoutInput;
  notionTask: {
    currentStatus?: string;
    pageId: string;
    title: string;
    url?: string;
  };
  plan: PostMergeCloseoutPlan;
  propertyWrites: PostMergeCloseoutPropertyWrite[];
};

export type PostMergeCloseoutResult = PostMergeCloseoutCommitResult | PostMergeCloseoutPreview;

type CreatePlanInput = {
  evidence: PostMergeCloseoutEvidence;
  mergedStatusName: string;
  statusPropertyName: string;
  statusPropertyType: NotionStatusPropertyType;
  task: AiBuildTask;
};

type PropertyCandidate = {
  names: string[];
  source: string;
  value?: string | number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function richTextUpdate(value: string) {
  return { rich_text: [{ text: { content: value }, type: "text" }] };
}

function updateForProperty(type: string | undefined, value: string | number): Record<string, unknown> | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  switch (type) {
    case "date":
      return typeof value === "string" ? { date: { start: value } } : undefined;
    case "number":
      return typeof value === "number" ? { number: value } : undefined;
    case "rich_text":
      return richTextUpdate(String(value));
    case "select":
      return { select: { name: String(value) } };
    case "url":
      return typeof value === "string" ? { url: value } : undefined;
    default:
      return undefined;
  }
}

function findPropertyName(properties: Record<string, unknown>, names: string[]): string | undefined {
  const entries = Object.entries(properties);

  for (const candidate of names) {
    const match = entries.find(([name]) => name.toLowerCase() === candidate.toLowerCase());
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

function countMarker(content: string, marker: string): number {
  if (!content || !marker) {
    return 0;
  }

  return content.split(marker).length - 1;
}

export function createPostMergeCloseoutMarker(evidence: PostMergeCloseoutEvidence): string {
  return `post-merge-closeout:${evidence.pullRequest.repository}#${evidence.pullRequest.pullRequestNumber}:${evidence.pullRequest.mergeSha}`;
}

function createBlockPreview(evidence: PostMergeCloseoutEvidence, marker: string): string {
  const deploymentSummary =
    evidence.deployment.status === "found"
      ? evidence.deployment.deployments
          .map((deployment) => `${deployment.environment ?? "deployment"}: ${deployment.state ?? "unknown"}${deployment.url ? ` (${deployment.url})` : ""}`)
          .join("; ")
      : evidence.deployment.message ?? "Deployment evidence not available.";

  return [
    `Post-Merge Closeout: ${evidence.pullRequest.repository}#${evidence.pullRequest.pullRequestNumber}`,
    `Marker: ${marker}`,
    `PR: ${evidence.pullRequest.url}`,
    `Merged: ${evidence.pullRequest.mergedAt} by ${evidence.pullRequest.mergedBy ?? "unknown"}`,
    `Merge SHA: ${evidence.pullRequest.mergeSha}`,
    `Branches: ${evidence.pullRequest.baseBranch} <- ${evidence.pullRequest.headBranch}`,
    `Deployment evidence: ${deploymentSummary}`,
    "Approval boundary: Closeout records an already-merged PR. It does not merge, deploy, or approve production.",
  ].join("\n");
}

function createStatusWrite(input: CreatePlanInput): PostMergeCloseoutPropertyWrite {
  const property = asRecord(input.task.properties[input.statusPropertyName]);
  const type = typeof property.type === "string" ? property.type : undefined;

  if (!type) {
    return {
      name: input.statusPropertyName,
      reason: "Configured status property is not present on the Notion task schema.",
      source: "Status after post-merge closeout",
      status: "skipped",
      value: input.mergedStatusName,
    };
  }

  if (type !== "select" && type !== "status") {
    return {
      name: input.statusPropertyName,
      reason: `Configured status property type ${type} is not supported for closeout writes.`,
      source: "Status after post-merge closeout",
      status: "skipped",
      type,
      value: input.mergedStatusName,
    };
  }

  const update = type === "select" ? { select: { name: input.mergedStatusName } } : { status: { name: input.mergedStatusName } };

  return {
    name: input.statusPropertyName,
    source: "Status after post-merge closeout",
    status: "planned",
    type,
    update,
    value: input.mergedStatusName,
  };
}

export function createPostMergeCloseoutPlan(input: CreatePlanInput): PostMergeCloseoutPlan {
  const marker = createPostMergeCloseoutMarker(input.evidence);
  const properties = input.task.properties;
  const deploymentUrl = input.evidence.deployment.deployments.find((deployment) => deployment.url)?.url;
  const candidates: PropertyCandidate[] = [
    { names: ["PR Link", "PR URL", "Pull Request", "Pull Request URL", "GitHub PR", "GitHub PR URL"], source: "Pull request URL", value: input.evidence.pullRequest.url },
    { names: ["Repository", "Repo", "GitHub Repository"], source: "GitHub repository", value: input.evidence.pullRequest.repository },
    { names: ["PR Number", "Pull Request Number"], source: "Pull request number", value: input.evidence.pullRequest.pullRequestNumber },
    { names: ["Merge SHA", "Merge Commit", "Merge Commit SHA", "Merged Commit SHA"], source: "Merge commit SHA", value: input.evidence.pullRequest.mergeSha },
    { names: ["Merged At", "Merged Date"], source: "Merged timestamp", value: input.evidence.pullRequest.mergedAt },
    { names: ["Merged By", "Merged By GitHub"], source: "GitHub user who merged the PR", value: input.evidence.pullRequest.mergedBy },
    { names: ["Base Branch"], source: "PR base branch", value: input.evidence.pullRequest.baseBranch },
    { names: ["Head Branch"], source: "PR head branch", value: input.evidence.pullRequest.headBranch },
    { names: ["Deployment URL", "Vercel Preview", "Vercel URL", "Production URL"], source: "Deployment evidence URL", value: deploymentUrl },
  ];
  const propertyWrites: PostMergeCloseoutPropertyWrite[] = [createStatusWrite(input)];

  for (const candidate of candidates) {
    const name = findPropertyName(properties, candidate.names) ?? candidate.names[0] ?? candidate.source;
    const property = asRecord(properties[name]);
    const type = typeof property.type === "string" ? property.type : undefined;

    if (!findPropertyName(properties, candidate.names)) {
      propertyWrites.push({
        name,
        reason: "Property is not present on the Notion task schema.",
        source: candidate.source,
        status: "skipped",
        value: candidate.value,
      });
      continue;
    }

    if (candidate.value === undefined || candidate.value === "") {
      propertyWrites.push({
        name,
        reason: "Evidence value is unavailable.",
        source: candidate.source,
        status: "skipped",
        type,
      });
      continue;
    }

    const update = updateForProperty(type, candidate.value);
    if (!update) {
      propertyWrites.push({
        name,
        reason: `Property type ${type ?? "unknown"} is not supported for closeout writes.`,
        source: candidate.source,
        status: "skipped",
        type,
        value: candidate.value,
      });
      continue;
    }

    propertyWrites.push({
      name,
      source: candidate.source,
      status: "planned",
      type,
      update,
      value: candidate.value,
    });
  }

  const duplicateMarkerCount = countMarker(input.task.contentMarkdown, marker);

  return {
    blockPreview: createBlockPreview(input.evidence, marker),
    closeoutMarker: marker,
    duplicateMarkerCount,
    markerAlreadyExists: duplicateMarkerCount > 0,
    propertyWrites,
  };
}

export function createPostMergeCloseoutDiagnostics(input: {
  evidence: PostMergeCloseoutEvidence;
  plan: PostMergeCloseoutPlan;
  task: AiBuildTask;
}): PostMergeCloseoutDiagnostics {
  return {
    deploymentLookup:
      input.evidence.deployment.status === "found"
        ? `found ${input.evidence.deployment.deployments.length} deployment record(s)`
        : `${input.evidence.deployment.status}: ${input.evidence.deployment.message ?? "no deployment evidence"}`,
    githubVerification: `merged PR verified at ${input.evidence.pullRequest.mergedAt} with merge SHA ${input.evidence.pullRequest.mergeSha}`,
    idempotency:
      input.plan.duplicateMarkerCount > 1
        ? `duplicate marker found ${input.plan.duplicateMarkerCount} times`
        : input.plan.markerAlreadyExists
          ? "marker already exists; block append will be skipped"
          : "marker not present; closeout block can be appended",
    notionTaskTarget: `${input.task.title} (${input.task.pageId})`,
    properties: input.plan.propertyWrites.map((write) =>
      write.status === "planned"
        ? `${write.name}: planned ${write.type ?? "unknown"} update`
        : `${write.name}: skipped - ${write.reason ?? "not writable"}`,
    ),
  };
}

export function createPostMergeCloseoutPreview(input: {
  evidence: PostMergeCloseoutEvidence;
  generatedAt: Date;
  plan: PostMergeCloseoutPlan;
  request: PostMergeCloseoutInput;
  task: AiBuildTask;
}): PostMergeCloseoutPreview {
  return {
    committed: false,
    diagnostics: createPostMergeCloseoutDiagnostics({ evidence: input.evidence, plan: input.plan, task: input.task }),
    evidence: input.evidence,
    generatedAt: input.generatedAt.toISOString(),
    input: input.request,
    notionTask: {
      ...(input.task.status ? { currentStatus: input.task.status } : {}),
      pageId: input.task.pageId,
      title: input.task.title,
      ...(input.task.url ? { url: input.task.url } : {}),
    },
    plan: input.plan,
  };
}

export function createPostMergeCloseoutCommitResult(input: {
  blockAppended: boolean;
  evidence: PostMergeCloseoutEvidence;
  generatedAt: Date;
  plan: PostMergeCloseoutPlan;
  propertyWrites: PostMergeCloseoutPropertyWrite[];
  request: PostMergeCloseoutInput;
  task: AiBuildTask;
}): PostMergeCloseoutCommitResult {
  const plan = {
    ...input.plan,
    propertyWrites: input.propertyWrites,
  };

  return {
    blockAppended: input.blockAppended,
    committed: true,
    diagnostics: createPostMergeCloseoutDiagnostics({ evidence: input.evidence, plan, task: input.task }),
    evidence: input.evidence,
    generatedAt: input.generatedAt.toISOString(),
    input: input.request,
    notionTask: {
      ...(input.task.status ? { currentStatus: input.task.status } : {}),
      pageId: input.task.pageId,
      title: input.task.title,
      ...(input.task.url ? { url: input.task.url } : {}),
    },
    plan,
    propertyWrites: input.propertyWrites,
  };
}
