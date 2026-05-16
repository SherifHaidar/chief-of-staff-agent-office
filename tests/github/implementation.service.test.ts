import { describe, expect, it, vi } from "vitest";

import type { CodexHandoffApprovalPayload } from "../../src/approval/codex-handoff-approval.js";
import type { AiBuildTask } from "../../src/domain/ai-build-task.js";
import type { ImplementationProposal } from "../../src/domain/implementation-proposal.js";
import { IMPLEMENTATION_PENDING_NOTICE } from "../../src/domain/implementation-proposal.js";
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

const task: AiBuildTask = {
  contentMarkdown: "Task page content.",
  pageId: payload.taskId,
  properties: {},
  status: "In Codex",
  title: "Improve task capture",
  url: "https://notion.example/task",
};

const proposal: ImplementationProposal = {
  approvalWarnings: [
    "Implementation pending. This draft PR is a starting point for Codex implementation, not the final deliverable.",
    "Agent Office will commit only the work-order file. Product code changes must happen later on this branch.",
    "Merge and deployment require separate final human approval.",
  ],
  baseBranch: "main",
  baseCommitSha: "base-sha",
  branchName: "agent-office/impl-improve-task-capture-22222222",
  commitMessage: "Add implementation work order for Improve task capture",
  draft: true,
  handoffSummary: {
    acceptanceChecklist: ["Task capture improvement is visible."],
    constraints: ["Do not merge or deploy without approval."],
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
  prBody: [
    "## Implementation pending",
    IMPLEMENTATION_PENDING_NOTICE,
    "",
    "## What Agent Office created",
    "- Repository: SherifHaidar/personal-chief-of-staff",
    "- Base: main @ base-sha",
    "- Branch: agent-office/impl-improve-task-capture-22222222",
    "- Task: Improve task capture (22222222-2222-2222-2222-222222222222)",
    "- Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
    "",
    "## Next action",
    "- Codex must implement on this branch, run relevant tests, and return evidence before human merge or deploy approval.",
    "- Codex should check out this branch, inspect the product repo directly, edit the real product files, run tests, and push implementation commits to this PR.",
    "",
    "## Approved handoff summary",
    "Problem: Task capture needs improvement.",
    "",
    "Product intent: Make capture smoother.",
    "",
    "### Implementation scope",
    "- Prepare implementation work.",
    "",
    "### Likely affected files or modules",
    "- lib/capture.ts",
    "",
    "### Tests to run",
    "- npm test",
    "",
    "## Approval boundary",
    "- This draft PR is a starting point for implementation, not the final deliverable.",
    "- Agent Office has not generated or committed product-code changes.",
    "- This PR must not be merged or deployed until Codex implementation, review, tests, and final human approval are complete.",
  ].join("\n"),
  prTitle: "[Draft] Implementation pending: Improve task capture",
  repository: "SherifHaidar/personal-chief-of-staff",
  taskId: "22222222-2222-2222-2222-222222222222",
  taskName: "Improve task capture",
  workOrderContent: [
    "# Agent Office Implementation Work Order",
    "",
    IMPLEMENTATION_PENDING_NOTICE,
    "",
    "## Task",
    "- Task ID: 22222222-2222-2222-2222-222222222222",
    "- Task name: Improve task capture",
    "- Notion status at preview: In Codex",
    "- Notion URL: https://notion.example/task",
    "",
    "## Branch and PR Starting Point",
    "- Repository: SherifHaidar/personal-chief-of-staff",
    "- Base branch: main",
    "- Base commit: base-sha",
    "- Branch: agent-office/impl-improve-task-capture-22222222",
    "- Draft PR title: [Draft] Implementation pending: Improve task capture",
    "- Work order path: .agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
    "",
    "## Next Action",
    "Codex must implement on this branch, run relevant tests, and return evidence before human merge or deploy approval.",
    "",
    "Codex should continue on this branch, inspect the product repository directly, make the real implementation commits, run the relevant checks, and report evidence before human approval.",
    "",
    "## Approved Codex Handoff Summary",
    "",
    "### Problem Summary",
    "Task capture needs improvement.",
    "",
    "### Product Intent",
    "Make capture smoother.",
    "",
    "### Implementation Scope",
    "- Prepare implementation work.",
    "",
    "### Likely Affected Files or Modules",
    "- lib/capture.ts",
    "",
    "### Constraints / Do Not Change",
    "- Do not merge or deploy without approval.",
    "",
    "### Implementation Steps",
    "- Inspect code",
    "- Implement",
    "- Test",
    "",
    "### Tests to Run",
    "- npm test",
    "",
    "### Acceptance Checklist",
    "- Task capture improvement is visible.",
    "",
    "## Draft PR Body",
    "```markdown",
  ].join("\n"),
  workOrderPath: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
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

  it("builds a deterministic work-order proposal from the approved handoff and task", async () => {
    const request = vi.fn().mockResolvedValueOnce({ object: { sha: "base-sha" } });
    const service = createService(request);

    const workOrder = await service.createWorkOrderProposal({ payload, task });

    expect(workOrder).toMatchObject({
      baseBranch: "main",
      baseCommitSha: "base-sha",
      branchName: "agent-office/impl-improve-task-capture-22222222",
      draft: true,
      handoffSummary: proposal.handoffSummary,
      prTitle: "[Draft] Implementation pending: Improve task capture",
      repository: "SherifHaidar/personal-chief-of-staff",
      taskId: "22222222-2222-2222-2222-222222222222",
      workOrderPath: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
    });
    expect(workOrder.prBody).toContain(IMPLEMENTATION_PENDING_NOTICE);
    expect(workOrder.prBody).toContain("Agent Office has not generated or committed product-code changes.");
    expect(workOrder.workOrderContent).toContain(IMPLEMENTATION_PENDING_NOTICE);
    expect(workOrder.workOrderContent).toContain("Codex should continue on this branch");
  });

  it("rejects work-order proposals that do not use the task-scoped work-order path", async () => {
    const service = createService();

    await expect(
      service.executeProposal({
        ...proposal,
        workOrderContent: `${IMPLEMENTATION_PENDING_NOTICE}\nCodex must implement next.`,
        workOrderPath: "lib/capture.ts",
      }),
    ).rejects.toThrow(ImplementationProposalPolicyError);
  });

  it("commits only the approved work-order file and opens a draft PR", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new GitHubApiError("Not Found", 404))
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
    const executableProposal = {
      ...proposal,
      workOrderContent: `${proposal.workOrderContent}\n${proposal.prBody}\n\`\`\`\n`,
    };

    const result = await service.executeProposal(executableProposal);

    expect(result).toMatchObject({
      branchName: proposal.branchName,
      checks: [{ conclusion: "success", name: "CI", status: "completed" }],
      commitSha: "commit-sha",
      draft: true,
      nextAction: proposal.nextAction,
      pullRequestNumber: 55,
      pullRequestUrl: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/55",
      workOrderPath: proposal.workOrderPath,
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          tree: [
            {
              content: executableProposal.workOrderContent,
              mode: "100644",
              path: ".agent-office/work-orders/22222222-2222-2222-2222-222222222222.md",
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
