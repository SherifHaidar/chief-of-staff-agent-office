import { describe, expect, it } from "vitest";

import {
  createGitHubDraftPrApproval,
  GITHUB_DRAFT_PR_APPROVAL_ACTION,
  verifyGitHubDraftPrApproval,
} from "../../src/approval/github-draft-pr-approval.js";
import type { GitHubDraftPrProposal } from "../../src/domain/github-draft-pr.js";

const secret = "test-approval-secret";
const now = new Date("2026-05-15T12:00:00.000Z");
const proposal: GitHubDraftPrProposal = {
  baseBranch: "main",
  baseCommitSha: "abc123",
  branchName: "agent-office/improve-task-capture-22222222",
  commitMessage: "Add Agent Office handoff for Improve task capture",
  draft: true,
  handoffFileContent: "# Agent Office Codex Handoff\n\nDraft only.",
  handoffFilePath: ".agent-office/handoffs/22222222-2222-2222-2222-222222222222.md",
  prBody: "## Agent Office Draft PR\n\nDraft only.",
  prTitle: "[Draft] Improve task capture",
  repository: "SherifHaidar/personal-chief-of-staff",
  taskId: "22222222-2222-2222-2222-222222222222",
  taskName: "Improve task capture",
};

describe("GitHub Draft PR approval tokens", () => {
  it("verifies a signed token and preserves the exact proposal", () => {
    const approval = createGitHubDraftPrApproval({
      now,
      previewRunId: "run_preview",
      proposal,
      secret,
    });

    const payload = verifyGitHubDraftPrApproval({ secret, token: approval.token, now });

    expect(approval).toMatchObject({
      action: GITHUB_DRAFT_PR_APPROVAL_ACTION,
      previewRunId: "run_preview",
    });
    expect(payload).toMatchObject({
      action: GITHUB_DRAFT_PR_APPROVAL_ACTION,
      previewRunId: "run_preview",
      proposal,
      proposalHash: approval.proposalHash,
    });
  });

  it("rejects expired tokens", () => {
    const approval = createGitHubDraftPrApproval({
      now,
      previewRunId: "run_preview",
      proposal,
      secret,
      ttlMinutes: 120,
    });

    expect(() =>
      verifyGitHubDraftPrApproval({
        now: new Date("2026-05-15T14:01:00.000Z"),
        secret,
        token: approval.token,
      }),
    ).toThrow("Approval token expired.");
  });

  it("rejects tampered tokens", () => {
    const approval = createGitHubDraftPrApproval({
      now,
      previewRunId: "run_preview",
      proposal,
      secret,
    });

    expect(() => verifyGitHubDraftPrApproval({ secret, token: `${approval.token}x`, now })).toThrow(
      "Invalid approval token.",
    );
  });
});
