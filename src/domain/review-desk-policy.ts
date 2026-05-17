import type { ClaudeReviewPacket, ReviewDeskEvidencePacket, ReviewDeskFinding } from "./review-desk.js";

const FAILED_CHECK_CONCLUSIONS = new Set([
  "action_required",
  "cancelled",
  "failure",
  "failed",
  "startup_failure",
  "timed_out",
]);

const PASSING_CHECK_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
const PENDING_CHECK_STATUSES = new Set(["in_progress", "pending", "queued", "requested", "waiting"]);

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isFailedCheck(input: { conclusion?: string | null; status: string }): boolean {
  const conclusion = normalizeStatus(input.conclusion);
  const status = normalizeStatus(input.status);

  if (FAILED_CHECK_CONCLUSIONS.has(conclusion) || FAILED_CHECK_CONCLUSIONS.has(status)) {
    return true;
  }

  return status === "completed" && conclusion.length > 0 && !PASSING_CHECK_CONCLUSIONS.has(conclusion);
}

export function isPendingCheck(input: { conclusion?: string | null; status: string }): boolean {
  const conclusion = normalizeStatus(input.conclusion);
  const status = normalizeStatus(input.status);

  return PENDING_CHECK_STATUSES.has(status) || PENDING_CHECK_STATUSES.has(conclusion);
}

function removeCodexFixBriefUnlessNeeded(review: ClaudeReviewPacket): ClaudeReviewPacket {
  if (review.verdict === "Needs Codex Fixes") {
    return review;
  }

  const { codexFixBrief, ...reviewWithoutFixBrief } = review;
  return reviewWithoutFixBrief;
}

export function evaluateReviewDeskEvidence(evidence: ReviewDeskEvidencePacket): ReviewDeskFinding[] {
  const findings: ReviewDeskFinding[] = [];

  if (evidence.workOrder.contentMarkdown.trim().length === 0 && !evidence.workOrder.prWorkOrderMarkdown?.trim()) {
    findings.push({
      message: "Notion task/work-order evidence is missing or unreadable.",
      severity: "blocking",
    });
  }

  if (evidence.pullRequest.changedFiles.length === 0) {
    findings.push({
      message: "Changed-file evidence is missing.",
      severity: "blocking",
    });
  }

  if (evidence.workOrder.acceptanceCriteria.length === 0) {
    findings.push({
      message: "Acceptance checklist evidence is missing or empty.",
      severity: "missing_evidence",
    });
  }

  const failedChecks = evidence.pullRequest.checks.filter(isFailedCheck);
  if (failedChecks.length > 0) {
    findings.push({
      message: `Required checks are failing: ${failedChecks.map((check) => `${check.name}: ${check.conclusion ?? check.status}`).join(", ")}.`,
      severity: "fixes_needed",
    });
  }

  const pendingChecks = evidence.pullRequest.checks.filter(isPendingCheck);
  if (pendingChecks.length > 0) {
    findings.push({
      message: `Required checks are not complete: ${pendingChecks.map((check) => `${check.name}: ${check.conclusion ?? check.status}`).join(", ")}.`,
      severity: "missing_evidence",
    });
  }

  if (evidence.pullRequest.deployments.length === 0) {
    findings.push({
      message: "No GitHub-exposed Vercel/deployment evidence was found.",
      severity: "missing_evidence",
    });
  }

  for (const warning of evidence.pullRequest.collectionWarnings) {
    findings.push({
      message: warning,
      severity: "missing_evidence",
    });
  }

  return findings;
}

export function hasBlockingFindings(findings: ReviewDeskFinding[]): boolean {
  return findings.some((finding) => finding.severity === "blocking");
}

export function hasFixRequiredFindings(findings: ReviewDeskFinding[]): boolean {
  return findings.some((finding) => finding.severity === "fixes_needed");
}

export function createBlockedReview(input: {
  evidence: ReviewDeskEvidencePacket;
  findings: ReviewDeskFinding[];
}): ClaudeReviewPacket {
  return {
    acceptanceChecklist: input.evidence.workOrder.acceptanceCriteria.map((criterion) => ({
      criterion,
      notes: "Not evaluated because required evidence is blocked.",
      status: "unclear",
    })),
    missingEvidence: input.findings
      .filter((finding) => finding.severity === "blocking" || finding.severity === "missing_evidence")
      .map((finding) => finding.message),
    risks: ["Review could not complete because required evidence is missing or unavailable."],
    suggestedSmokeTests: [],
    summary: "Review blocked before Claude review because required implementation evidence is incomplete.",
    verdict: "Blocked",
  };
}

export function applyReviewDeskPostGates(input: {
  evidence: ReviewDeskEvidencePacket;
  findings: ReviewDeskFinding[];
  review: ClaudeReviewPacket;
}): ClaudeReviewPacket {
  if (hasBlockingFindings(input.findings)) {
    return createBlockedReview(input);
  }

  if (hasFixRequiredFindings(input.findings) && input.review.verdict === "Ready for Human Smoke Test") {
    return removeCodexFixBriefUnlessNeeded({
      ...input.review,
      missingEvidence: Array.from(
        new Set([...input.review.missingEvidence, ...input.findings.map((finding) => finding.message)]),
      ),
      verdict: "Needs Codex Fixes",
    });
  }

  return removeCodexFixBriefUnlessNeeded({
    ...input.review,
    missingEvidence: Array.from(
      new Set([
        ...input.review.missingEvidence,
        ...input.findings.filter((finding) => finding.severity === "missing_evidence").map((finding) => finding.message),
      ]),
    ),
  });
}
