import { describe, expect, it } from "vitest";

import {
  createImplementationApproval,
  IMPLEMENTATION_APPROVAL_ACTION,
  verifyImplementationApproval,
} from "../../src/approval/implementation-approval.js";
import type { ImplementationProposal } from "../../src/domain/implementation-proposal.js";
import { IMPLEMENTATION_PENDING_NOTICE } from "../../src/domain/implementation-proposal.js";

const secret = "test-approval-secret";
const now = new Date("2026-05-15T12:00:00.000Z");
const proposal: ImplementationProposal = {
  approvalWarnings: [
    "Implementation pending. This draft PR is a starting point for Codex implementation, not the final deliverable.",
    "Agent Office will commit only the work-order file. Product code changes must happen later on this branch.",
    "Merge and deployment require separate final human approval.",
  ],
  baseBranch: "main",
  baseCommitSha: "abc123",
  branchName: "agent-office/impl-improve-task-capture-22222222",
  commitMessage: "Add implementation work order for Improve task capture",
  draft: true,
  handoffSummary: {
    acceptanceChecklist: ["Capture works."],
    constraints: ["Do not merge or deploy."],
    implementationScope: ["Prepare implementation work."],
    implementationSteps: ["Inspect code", "Implement", "Test"],
    likelyAffectedFiles: ["lib/capture.ts"],
    problemSummary: "Task capture needs improvement.",
    productIntent: "Make capture smoother.",
    suggestedBranchName: "codex/improve-task-capture",
    suggestedPrTitle: "Improve task capture",
    testsToRun: ["npm test"],
  },
  nextAction: "Codex must implement on this branch, run relevant tests, and return evidence before human merge or deploy approval.",
  prBody: `${IMPLEMENTATION_PENDING_NOTICE}\n\nWork order only.`,
  prTitle: "[Draft] Implementation pending: Improve task capture",
  repository: "SherifHaidar/personal-chief-of-staff",
  taskId: "22222222-2222-2222-2222-222222222222",
  taskName: "Improve task capture",
  workOrderContent: `${IMPLEMENTATION_PENDING_NOTICE}\n\n# Work order\nCodex must implement next.`,
  workOrderPath: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
};

describe("Implementation approval tokens", () => {
  it("verifies a signed token and preserves the exact work-order proposal", () => {
    const approval = createImplementationApproval({
      now,
      previewRunId: "run_preview",
      proposal,
      secret,
    });

    const payload = verifyImplementationApproval({ secret, token: approval.token, now });

    expect(approval).toMatchObject({
      action: IMPLEMENTATION_APPROVAL_ACTION,
      previewRunId: "run_preview",
    });
    expect(payload).toMatchObject({
      action: IMPLEMENTATION_APPROVAL_ACTION,
      previewRunId: "run_preview",
      proposal,
      proposalHash: approval.proposalHash,
    });
  });

  it("rejects expired tokens", () => {
    const approval = createImplementationApproval({
      now,
      previewRunId: "run_preview",
      proposal,
      secret,
      ttlMinutes: 120,
    });

    expect(() =>
      verifyImplementationApproval({
        now: new Date("2026-05-15T14:01:00.000Z"),
        secret,
        token: approval.token,
      }),
    ).toThrow("Approval token expired.");
  });

  it("rejects tampered tokens", () => {
    const approval = createImplementationApproval({
      now,
      previewRunId: "run_preview",
      proposal,
      secret,
    });

    expect(() => verifyImplementationApproval({ secret, token: `${approval.token}x`, now })).toThrow(
      "Invalid approval token.",
    );
  });
});
