import { describe, expect, it } from "vitest";

import type { ClaudeReviewPacket, ReviewDeskEvidencePacket } from "../../src/domain/review-desk.js";
import {
  applyReviewDeskPostGates,
  evaluateReviewDeskEvidence,
  hasBlockingFindings,
} from "../../src/domain/review-desk-policy.js";

function evidence(overrides: Partial<ReviewDeskEvidencePacket> = {}): ReviewDeskEvidencePacket {
  return {
    collectedAt: "2026-05-17T10:00:00.000Z",
    input: {
      pullRequestNumber: 6,
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: "22222222-2222-2222-2222-222222222222",
    },
    missingEvidence: [],
    policyFindings: [],
    pullRequest: {
      baseBranch: "main",
      body: "Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
      changedFiles: [{ additions: 2, deletions: 1, path: "src/app.ts", patch: "@@ test", patchTruncated: false, status: "modified" }],
      checks: [{ conclusion: "success", name: "CI", status: "completed" }],
      collectionWarnings: [],
      deployments: [{ environment: "Preview", state: "success", statuses: [], url: "https://example.vercel.app" }],
      draft: true,
      headBranch: "feature/test",
      headSha: "abc123",
      pullRequestNumber: 6,
      repository: "SherifHaidar/personal-chief-of-staff",
      state: "open",
      title: "Test PR",
      url: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/6",
    },
    workOrder: {
      acceptanceCriteria: ["Review packet is generated."],
      contentMarkdown: "### Acceptance Checklist\n- Review packet is generated.",
      pageTitle: "Review task",
      taskId: "22222222-2222-2222-2222-222222222222",
    },
    ...overrides,
  };
}

const readyReview: ClaudeReviewPacket = {
  acceptanceChecklist: [{ criterion: "Review packet is generated.", notes: "Looks covered.", status: "pass" }],
  missingEvidence: [],
  risks: [],
  suggestedSmokeTests: ["Open the preview."],
  summary: "Ready for smoke testing.",
  verdict: "Ready for Human Smoke Test",
};

describe("Review Desk deterministic policy", () => {
  it("blocks when changed-file evidence is missing", () => {
    const packet = evidence({
      pullRequest: {
        ...evidence().pullRequest,
        changedFiles: [],
      },
    });
    const findings = evaluateReviewDeskEvidence(packet);

    expect(hasBlockingFindings(findings)).toBe(true);
    expect(findings).toContainEqual({ message: "Changed-file evidence is missing.", severity: "blocking" });
  });

  it("records missing deployment evidence without blocking the review", () => {
    const packet = evidence({
      pullRequest: {
        ...evidence().pullRequest,
        deployments: [],
      },
    });
    const findings = evaluateReviewDeskEvidence(packet);

    expect(hasBlockingFindings(findings)).toBe(false);
    expect(findings).toContainEqual({
      message: "No GitHub-exposed Vercel/deployment evidence was found.",
      severity: "missing_evidence",
    });
  });

  it("downgrades ready verdicts when required checks are failing", () => {
    const packet = evidence({
      pullRequest: {
        ...evidence().pullRequest,
        checks: [{ conclusion: "failure", name: "CI", status: "completed" }],
      },
    });
    const findings = evaluateReviewDeskEvidence(packet);
    const review = applyReviewDeskPostGates({ evidence: packet, findings, review: readyReview });

    expect(review.verdict).toBe("Needs Codex Fixes");
    expect(review.missingEvidence).toContain("Required checks are failing: CI: failure.");
  });
});

