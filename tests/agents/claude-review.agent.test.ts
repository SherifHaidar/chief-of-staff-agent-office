import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicClaudeReviewRunner } from "../../src/agents/claude-review.agent.js";
import type { ClaudeReviewPacket, ReviewDeskEvidencePacket } from "../../src/domain/review-desk.js";

const evidence: ReviewDeskEvidencePacket = {
  collectedAt: "2026-05-17T10:00:00.000Z",
  input: {
    pullRequestNumber: 20,
    repository: "SherifHaidar/chief-of-staff-agent-office",
    taskId: "22222222-2222-2222-2222-222222222222",
  },
  missingEvidence: [],
  policyFindings: [],
  pullRequest: {
    baseBranch: "main",
    body: "Work order: `.agent-office/work-orders/22222222-2222-2222-2222-222222222222.md`",
    changedFiles: [{ additions: 5, deletions: 1, path: "src/review.ts", patchTruncated: false, status: "modified" }],
    checks: [{ conclusion: "success", name: "Typecheck and test", status: "completed" }],
    collectionWarnings: [],
    deployments: [],
    draft: true,
    headBranch: "agent-office/impl-review",
    headSha: "head-sha",
    pullRequestNumber: 20,
    repository: "SherifHaidar/chief-of-staff-agent-office",
    state: "open",
    title: "Add Review Desk",
    url: "https://github.com/SherifHaidar/chief-of-staff-agent-office/pull/20",
  },
  workOrder: {
    acceptanceCriteria: ["Review packet is generated."],
    contentMarkdown: "### Acceptance Checklist\n- Review packet is generated.",
    pageTitle: "Review task",
    taskId: "22222222-2222-2222-2222-222222222222",
  },
};

const reviewPacket: ClaudeReviewPacket = {
  acceptanceChecklist: [{ criterion: "Review packet is generated.", notes: "Covered by the PR.", status: "pass" }],
  missingEvidence: [],
  risks: ["Manual smoke testing is still required."],
  suggestedSmokeTests: ["Run the Review Desk against PR #20."],
  summary: "Ready for human smoke testing.",
  verdict: "Ready for Human Smoke Test",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

describe("AnthropicClaudeReviewRunner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests and parses structured Claude tool output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        content: [{ input: reviewPacket, name: "emit_review_packet", type: "tool_use" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AnthropicClaudeReviewRunner({
      apiKey: "test-key",
      model: "claude-sonnet-test",
    }).review(evidence);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(result).toEqual(reviewPacket);
    expect(requestBody.tool_choice).toEqual({ name: "emit_review_packet", type: "tool" });
    expect(requestBody.tools[0].name).toBe("emit_review_packet");
  });

  it("rejects invalid structured Claude tool output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          content: [
            {
              input: { ...reviewPacket, verdict: "Merge Ready" },
              name: "emit_review_packet",
              type: "tool_use",
            },
          ],
        }),
      ),
    );

    await expect(
      new AnthropicClaudeReviewRunner({
        apiKey: "test-key",
        model: "claude-sonnet-test",
      }).review(evidence),
    ).rejects.toThrow("Claude structured review validation failed");
  });

  it("returns a specific configuration error when Anthropic rejects the configured model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              message: "model: claude-3-5-sonnet-latest",
              type: "not_found_error",
            },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      new AnthropicClaudeReviewRunner({
        apiKey: "test-key",
        model: "claude-3-5-sonnet-latest",
      }).review(evidence),
    ).rejects.toThrow("Claude review model is unavailable or misconfigured: claude-3-5-sonnet-latest");
  });
});
