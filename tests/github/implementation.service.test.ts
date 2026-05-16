import { describe, expect, it, vi } from "vitest";

import type { CodexHandoffApprovalPayload } from "../../src/approval/codex-handoff-approval.js";
import type { ImplementationProposal } from "../../src/domain/implementation-proposal.js";
import { GitHubApiError, type GitHubAppClient } from "../../src/github/github-app-client.js";
import { ImplementationProposalPolicyError, ImplementationService } from "../../src/github/implementation.service.js";

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
    likelyAffectedFiles: ["lib/capture.ts"],
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

const proposal: ImplementationProposal = {
  approvalWarnings: ["Draft only. Merge and deployment require Sherif approval."],
  baseBranch: "main",
  baseCommitSha: "base-sha",
  branchName: "agent-office/impl-improve-task-capture-22222222",
  changedFiles: [
    {
      action: "update",
      content: "export const captureEnabled = true;\n",
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

function createClient(request = vi.fn()) {
  return { request } as unknown as GitHubAppClient;
}

function createService(request = vi.fn()) {
  return new ImplementationService(createClient(request), {
    allowedBranchPrefixes: ["agent-office/", "codex/"],
    allowedRepositories: ["SherifHaidar/personal-chief-of-staff"],
    defaultBaseBranch: "main",
    maxChangedFiles: 4,
    maxFileChars: 16_000,
    maxTotalChangeChars: 32_000,
  });
}

describe("ImplementationService", () => {
  it("creates a safe proposal shell from an approved Codex handoff", async () => {
    const request = vi.fn().mockResolvedValueOnce({ object: { sha: "base-sha" } });
    const service = createService(request);

    const shell = await service.createProposalShell(payload);

    expect(shell).toEqual({
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-improve-task-capture-22222222",
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("rejects protected implementation paths", () => {
    const service = createService();

    expect(() =>
      service.finalizeProposal({
        payload,
        proposal: {
          ...proposal,
          changedFiles: [{ ...proposal.changedFiles[0]!, path: ".github/workflows/ci.yml" }],
        },
        shell: {
          baseBranch: "main",
          baseCommitSha: "base-sha",
          branchName: "agent-office/impl-improve-task-capture-22222222",
          repository: "SherifHaidar/personal-chief-of-staff",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      }),
    ).toThrow(ImplementationProposalPolicyError);
  });

  it("allows .env.example as a template documentation file", () => {
    const service = createService();

    expect(
      service.finalizeProposal({
        payload,
        proposal: {
          ...proposal,
          changedFiles: [
            {
              action: "update",
              content: "NOTION_TASKS_DATABASE_ID=\n",
              path: ".env.example",
              summary: "Document the Tasks DB environment variable.",
            },
          ],
        },
        shell: {
          baseBranch: "main",
          baseCommitSha: "base-sha",
          branchName: "agent-office/impl-improve-task-capture-22222222",
          repository: "SherifHaidar/personal-chief-of-staff",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      }).changedFiles,
    ).toEqual([
      {
        action: "update",
        content: "NOTION_TASKS_DATABASE_ID=\n",
        path: ".env.example",
        summary: "Document the Tasks DB environment variable.",
      },
    ]);
  });

  it("still rejects real env and secret paths", () => {
    const service = createService();
    const protectedPaths = [
      ".env",
      ".env.local",
      ".env.production",
      "config/.env",
      "config/.env.example",
      "secrets/notion.txt",
      "config/secrets/notion.txt",
      "private.pem",
      "private.key",
    ];

    for (const path of protectedPaths) {
      expect(() =>
        service.finalizeProposal({
          payload,
          proposal: {
            ...proposal,
            changedFiles: [{ ...proposal.changedFiles[0]!, path }],
          },
          shell: {
            baseBranch: "main",
            baseCommitSha: "base-sha",
            branchName: "agent-office/impl-improve-task-capture-22222222",
            repository: "SherifHaidar/personal-chief-of-staff",
            taskId: "22222222-2222-2222-2222-222222222222",
          },
        }),
      ).toThrow(ImplementationProposalPolicyError);
    }
  });

  it("requires a task name when finalizing an implementation proposal", () => {
    const service = createService();
    const { taskName: _payloadTaskName, ...payloadWithoutTaskName } = payload;
    const { taskName: _proposalTaskName, ...proposalWithoutTaskName } = proposal;

    expect(() =>
      service.finalizeProposal({
        payload: payloadWithoutTaskName as CodexHandoffApprovalPayload,
        proposal: proposalWithoutTaskName as unknown as ImplementationProposal,
        shell: {
          baseBranch: "main",
          baseCommitSha: "base-sha",
          branchName: "agent-office/impl-improve-task-capture-22222222",
          repository: "SherifHaidar/personal-chief-of-staff",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      }),
    ).toThrow("Implementation proposals require a task name.");
  });

  it("requires updated files to be fully included in product context during preview", () => {
    const service = createService();

    expect(() =>
      service.finalizeProposal({
        payload,
        productContext: {
          budgets: { maxFileChars: 1000, maxFiles: 1, maxNotionChars: 1000, maxTotalChars: 2000 },
          contextGaps: [],
          generatedAt: "2026-05-15T12:00:00.000Z",
          included: true,
          repoContext: {
            files: [{ chars: 10, content: "truncated", path: "lib/capture.ts", reason: "test", truncated: true }],
            fileTreeSample: ["lib/capture.ts"],
            totalFiles: 1,
            truncatedTree: false,
          },
          sources: [],
          targetProductRepo: payload.targetProductRepo,
        },
        proposal,
        shell: {
          baseBranch: "main",
          baseCommitSha: "base-sha",
          branchName: "agent-office/impl-improve-task-capture-22222222",
          repository: "SherifHaidar/personal-chief-of-staff",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      }),
    ).toThrow("was not fully included");
  });

  it("commits exact approved file changes and opens a draft PR", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new GitHubApiError("Not Found", 404))
      .mockResolvedValueOnce({ type: "file", sha: "file-sha" })
      .mockResolvedValueOnce({ sha: "base-sha", tree: { sha: "base-tree" } })
      .mockResolvedValueOnce({ sha: "new-tree" })
      .mockResolvedValueOnce({ sha: "commit-sha", tree: { sha: "new-tree" } })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        html_url: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/55",
        number: 55,
      })
      .mockResolvedValueOnce({
        check_runs: [{ conclusion: "success", details_url: "https://checks.example", name: "CI", status: "completed" }],
      })
      .mockResolvedValueOnce({ statuses: [] });
    const service = createService(request);

    const result = await service.executeProposal(proposal);

    expect(result).toMatchObject({
      branchName: proposal.branchName,
      changedFiles: [{ action: "update", path: "lib/capture.ts", summary: "Enable the safer capture path." }],
      checks: [{ conclusion: "success", name: "CI", status: "completed" }],
      commitSha: "commit-sha",
      draft: true,
      pullRequestNumber: 55,
      pullRequestUrl: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/55",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          tree: [
            {
              content: "export const captureEnabled = true;\n",
              mode: "100644",
              path: "lib/capture.ts",
              type: "blob",
            },
          ],
        }),
        method: "POST",
        path: "/repos/SherifHaidar/personal-chief-of-staff/git/trees",
      }),
    );
  });
});
