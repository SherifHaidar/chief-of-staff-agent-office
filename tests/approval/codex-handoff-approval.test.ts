import { describe, expect, it } from "vitest";

import {
  CODEX_HANDOFF_APPROVAL_ACTION,
  createCodexHandoffApproval,
  verifyCodexHandoffApproval,
} from "../../src/approval/codex-handoff-approval.js";
import type { CodexHandoffBrief } from "../../src/domain/codex-handoff-brief.js";

const secret = "test-approval-secret";
const now = new Date("2026-05-15T12:00:00.000Z");
const handoff: CodexHandoffBrief = {
  acceptanceChecklist: ["Chief of Staff task behavior is verified."],
  constraints: ["Do not merge or deploy without Sherif approval."],
  explicitApprovalWarnings: ["Merge requires Sherif approval.", "Deployment requires Sherif approval."],
  implementationScope: ["Implement the smallest product change described by the task."],
  implementationSteps: ["Inspect the product repo", "Make the scoped change", "Run tests"],
  likelyAffectedFiles: ["Confirm affected files during implementation."],
  problemSummary: "The Chief of Staff app needs a scoped implementation task.",
  productIntent: "Improve the real product without uncontrolled automation.",
  suggestedBranchName: "codex/scoped-product-task",
  suggestedPrBody: "## Summary\n- Implement the scoped Chief of Staff app task\n\n## Testing\n- npm test",
  suggestedPrTitle: "Implement scoped Chief of Staff app task",
  targetProductRepo: "SherifHaidar/personal-chief-of-staff",
  testsToRun: ["npm test"],
};

describe("Codex Handoff approval tokens", () => {
  it("verifies a signed token and preserves the exact handoff", () => {
    const approval = createCodexHandoffApproval({
      handoff,
      now,
      previewRunId: "run_preview",
      secret,
      statusAfterWriteback: "In Codex",
      targetProductRepo: handoff.targetProductRepo,
      taskId: "task-123",
      taskName: "Test task",
    });

    const payload = verifyCodexHandoffApproval({ secret, token: approval.token, now });

    expect(approval).toMatchObject({
      action: CODEX_HANDOFF_APPROVAL_ACTION,
      previewRunId: "run_preview",
    });
    expect(payload).toMatchObject({
      action: CODEX_HANDOFF_APPROVAL_ACTION,
      handoff,
      handoffHash: approval.handoffHash,
      previewRunId: "run_preview",
      statusAfterWriteback: "In Codex",
      targetProductRepo: handoff.targetProductRepo,
      taskId: "task-123",
      taskName: "Test task",
    });
  });

  it("rejects expired tokens", () => {
    const approval = createCodexHandoffApproval({
      handoff,
      now,
      previewRunId: "run_preview",
      secret,
      statusAfterWriteback: "In Codex",
      targetProductRepo: handoff.targetProductRepo,
      taskId: "task-123",
      ttlMinutes: 120,
    });

    expect(() =>
      verifyCodexHandoffApproval({
        now: new Date("2026-05-15T14:01:00.000Z"),
        secret,
        token: approval.token,
      }),
    ).toThrow("Approval token expired.");
  });

  it("rejects tampered tokens", () => {
    const approval = createCodexHandoffApproval({
      handoff,
      now,
      previewRunId: "run_preview",
      secret,
      statusAfterWriteback: "In Codex",
      targetProductRepo: handoff.targetProductRepo,
      taskId: "task-123",
    });

    expect(() => verifyCodexHandoffApproval({ secret, token: `${approval.token}x`, now })).toThrow(
      "Invalid approval token.",
    );
  });
});
