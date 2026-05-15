import { describe, expect, it, vi } from "vitest";

import type { CodexHandoffApprovalPayload } from "../../src/approval/codex-handoff-approval.js";
import type { GitHubAppClient } from "../../src/github/github-app-client.js";
import { GitHubDraftPrConflictError, GitHubDraftPrService } from "../../src/github/github-draft-pr.service.js";

const payload: CodexHandoffApprovalPayload = {
  action: "codex-handoff-writeback",
  createdAt: "2026-05-15T12:00:00.000Z",
  expiresAt: "2026-05-15T14:00:00.000Z",
  handoff: {
    acceptanceChecklist: ["Task capture improvement is visible."],
    constraints: ["Do not merge or deploy without approval."],
    explicitApprovalWarnings: ["Merge requires Sherif approval.", "Deployment requires Sherif approval."],
    implementationScope: ["Prepare implementation work."],
    implementationSteps: ["Inspect code", "Implement", "Test"],
    likelyAffectedFiles: ["Confirm during implementation."],
    problemSummary: "Task capture needs improvement.",
    productIntent: "Make capture smoother.",
    suggestedBranchName: "codex/improve-task-capture",
    suggestedPrBody: "## Summary\n- Improve capture",
    suggestedPrTitle: "Improve task capture",
    targetProductRepo: "SherifHaidar/personal-chief-of-staff",
    testsToRun: ["npm test"],
  },
  handoffHash: "hash",
  previewRunId: "run_preview",
  statusAfterWriteback: "In Codex",
  targetProductRepo: "SherifHaidar/personal-chief-of-staff",
  taskId: "22222222-2222-2222-2222-222222222222",
  taskName: "Improve task capture",
};

function createClient(request = vi.fn()) {
  return { request } as unknown as GitHubAppClient;
}

describe("GitHubDraftPrService", () => {
  it("creates a safe draft PR proposal from an approved Codex handoff", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ object: { sha: "base-sha" } })
      .mockRejectedValueOnce(Object.assign(new Error("Not Found"), { statusCode: 404, name: "GitHubApiError" }))
      .mockResolvedValueOnce([]);
    const service = new GitHubDraftPrService(createClient(request), {
      allowedBranchPrefixes: ["agent-office/", "codex/"],
      allowedRepositories: ["SherifHaidar/personal-chief-of-staff"],
      defaultBaseBranch: "main",
    });

    const proposal = await service.createProposal({ now: new Date("2026-05-15T12:00:00.000Z"), payload });

    expect(proposal).toMatchObject({
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/improve-task-capture-22222222",
      draft: true,
      handoffFilePath: ".agent-office/handoffs/22222222-2222-2222-2222-222222222222.md",
      prTitle: "[Draft] Improve task capture",
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: "22222222-2222-2222-2222-222222222222",
    });
    expect(proposal.handoffFileContent).toContain("# Agent Office Codex Handoff");
    expect(proposal.handoffFileContent).toContain("Draft only");
    expect(proposal.prBody).toContain("not merged, not deployed");
  });

  it("rejects repositories outside the allowlist", async () => {
    const service = new GitHubDraftPrService(createClient(), {
      allowedBranchPrefixes: ["agent-office/"],
      allowedRepositories: ["SherifHaidar/personal-chief-of-staff"],
      defaultBaseBranch: "main",
    });

    await expect(
      service.createProposal({
        payload: {
          ...payload,
          handoff: { ...payload.handoff, targetProductRepo: "SherifHaidar/other-repo" },
          targetProductRepo: "SherifHaidar/other-repo",
        },
      }),
    ).rejects.toThrow("not allowlisted");
  });

  it("rejects duplicate branches before writing", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ object: { sha: "base-sha" } })
      .mockResolvedValueOnce({ object: { sha: "existing-branch-sha" } });
    const service = new GitHubDraftPrService(createClient(request), {
      allowedBranchPrefixes: ["agent-office/"],
      allowedRepositories: ["SherifHaidar/personal-chief-of-staff"],
      defaultBaseBranch: "main",
    });

    await expect(service.createProposal({ payload })).rejects.toBeInstanceOf(GitHubDraftPrConflictError);
  });
});
