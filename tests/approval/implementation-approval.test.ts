import { describe, expect, it } from "vitest";

import {
  createImplementationApproval,
  IMPLEMENTATION_APPROVAL_ACTION,
  verifyImplementationApproval,
} from "../../src/approval/implementation-approval.js";
import type { ImplementationProposal } from "../../src/domain/implementation-proposal.js";

const secret = "test-approval-secret";
const now = new Date("2026-05-15T12:00:00.000Z");
const proposal: ImplementationProposal = {
  approvalWarnings: ["Draft only. Merge and deployment require Sherif approval."],
  baseBranch: "main",
  baseCommitSha: "abc123",
  branchName: "agent-office/impl-improve-task-capture-22222222",
  changedFiles: [
    {
      action: "update",
      content: "export const value = true;\n",
      path: "lib/capture.ts",
      summary: "Enable the safer capture path.",
    },
  ],
  commitMessage: "Implement safer capture path",
  contextGaps: [],
  draft: true,
  implementationSummary: "Update the capture helper.",
  prBody: "## Summary\n- Update capture helper",
  prTitle: "[Draft] Improve task capture",
  repository: "SherifHaidar/personal-chief-of-staff",
  taskId: "22222222-2222-2222-2222-222222222222",
  taskName: "Improve task capture",
  verificationPlan: {
    acceptanceCriteria: ["Capture still succeeds."],
    automatedChecks: ["npm test"],
    evidenceToCollect: ["GitHub checks"],
    manualChecks: ["Submit a test capture."],
    regressionRisks: ["Capture API regression."],
  },
};

describe("Implementation approval tokens", () => {
  it("verifies a signed token and preserves the exact proposed file changes", () => {
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
