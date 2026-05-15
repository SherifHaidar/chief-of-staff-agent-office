import { describe, expect, it } from "vitest";

import {
  ARCHITECT_BRIEF_APPROVAL_ACTION,
  createArchitectBriefApproval,
  verifyArchitectBriefApproval,
} from "../../src/approval/architect-brief-approval.js";
import type { ArchitectBrief } from "../../src/domain/architect-brief.js";

const secret = "test-approval-secret";
const now = new Date("2026-05-15T12:00:00.000Z");
const brief: ArchitectBrief = {
  briefTitle: "Operator Console v0",
  configuration: ["Set AGENT_OFFICE_APPROVAL_SECRET"],
  dependencies: [],
  executiveSummary: "Add a signed approval flow for exact Architect Brief writeback.",
  fileStructure: ["src/approval/architect-brief-approval.ts"],
  implementationPlan: ["Preview", "Approve", "Write exact brief"],
  openQuestions: [],
  recommendedArchitecture: ["Use a stateless signed approval token."],
  risks: ["Approval tokens must expire."],
};

describe("Architect Brief approval tokens", () => {
  it("verifies a signed token and preserves the exact brief", () => {
    const approval = createArchitectBriefApproval({
      brief,
      now,
      previewRunId: "run_preview",
      secret,
      statusAfterWriteback: "Ready for Codex",
      taskId: "task-123",
      taskName: "Test task",
    });

    const payload = verifyArchitectBriefApproval({ secret, token: approval.token, now });

    expect(approval).toMatchObject({
      action: ARCHITECT_BRIEF_APPROVAL_ACTION,
      previewRunId: "run_preview",
    });
    expect(payload).toMatchObject({
      action: ARCHITECT_BRIEF_APPROVAL_ACTION,
      brief,
      briefHash: approval.briefHash,
      previewRunId: "run_preview",
      statusAfterWriteback: "Ready for Codex",
      taskId: "task-123",
      taskName: "Test task",
    });
  });

  it("rejects expired tokens", () => {
    const approval = createArchitectBriefApproval({
      brief,
      now,
      previewRunId: "run_preview",
      secret,
      statusAfterWriteback: "Ready for Codex",
      taskId: "task-123",
      ttlMinutes: 120,
    });

    expect(() =>
      verifyArchitectBriefApproval({
        now: new Date("2026-05-15T14:01:00.000Z"),
        secret,
        token: approval.token,
      }),
    ).toThrow("Approval token expired.");
  });

  it("rejects tampered tokens", () => {
    const approval = createArchitectBriefApproval({
      brief,
      now,
      previewRunId: "run_preview",
      secret,
      statusAfterWriteback: "Ready for Codex",
      taskId: "task-123",
    });

    expect(() => verifyArchitectBriefApproval({ secret, token: `${approval.token}x`, now })).toThrow("Invalid approval token.");
  });
});
