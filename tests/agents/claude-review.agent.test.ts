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

const needsFixReviewPacket: ClaudeReviewPacket = {
  acceptanceChecklist: [{ criterion: "A fix brief is generated.", notes: "The PR needs targeted fixes.", status: "fail" }],
  codexFixBrief: {
    instructions: ["Move fix instructions under codexFixBrief.instructions."],
    summary: "Fix malformed Claude review packet output.",
    verification: ["Run the Claude review agent tests."],
  },
  missingEvidence: [],
  risks: ["Structured review output may be rejected if malformed."],
  suggestedSmokeTests: ["Rerun Review Desk on PR #20."],
  summary: "Needs Codex fixes before smoke testing.",
  verdict: "Needs Codex Fixes",
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
    expect(requestBody.tools[0].input_schema.additionalProperties).toBe(false);
    expect(requestBody.tools[0].input_schema.properties.instructions).toBeUndefined();
    expect(requestBody.tools[0].input_schema.properties.codexFixBrief.type).toBe("object");
    expect(requestBody.tools[0].input_schema.properties.codexFixBrief.properties.instructions.type).toBe("array");
    expect(requestBody.messages[0].content).not.toContain("Chief of Staff do-not-break flows");
  });

  it("includes Chief of Staff do-not-break flows when reviewing the product repo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        content: [{ input: reviewPacket, name: "emit_review_packet", type: "tool_use" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const productEvidence: ReviewDeskEvidencePacket = {
      ...evidence,
      input: {
        ...evidence.input,
        pullRequestNumber: 44,
        repository: "SherifHaidar/personal-chief-of-staff",
      },
      pullRequest: {
        ...evidence.pullRequest,
        pullRequestNumber: 44,
        repository: "SherifHaidar/personal-chief-of-staff",
        url: "https://github.com/SherifHaidar/personal-chief-of-staff/pull/44",
      },
    };

    await new AnthropicClaudeReviewRunner({
      apiKey: "test-key",
      model: "claude-sonnet-test",
    }).review(productEvidence);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(requestBody.messages[0].content).toContain("Chief of Staff do-not-break flows");
    expect(requestBody.messages[0].content).toContain("do not append broad Daily Capture digests to Weekly To-do");
    expect(requestBody.messages[0].content).toContain("Standalone memory confirmation supports short yes replies");
    expect(requestBody.messages[0].content).toContain("Do not include codexFixBrief unless the final verdict is Needs Codex Fixes.");
    expect(requestBody.messages[0].content).toContain("Do not emit top-level instructions");
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

  it("rejects malformed fix brief output with top-level instructions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          content: [
            {
              input: {
                ...needsFixReviewPacket,
                codexFixBrief: "Fix this by changing the prompt.",
                instructions: ["This must not be accepted at the root."],
              },
              name: "emit_review_packet",
              type: "tool_use",
            },
          ],
        }),
      ),
    );

    let thrown: unknown;
    try {
      await new AnthropicClaudeReviewRunner({
        apiKey: "test-key",
        model: "claude-sonnet-test",
      }).review(evidence);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("Claude structured review validation failed");
    expect((thrown as Error).message).toContain("codexFixBrief: Invalid input: expected object, received string");
    expect((thrown as Error).message).toContain('root: Unrecognized key: "instructions"');
  });

  it("parses a valid Needs Codex Fixes packet with an object Codex fix brief", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          content: [{ input: needsFixReviewPacket, name: "emit_review_packet", type: "tool_use" }],
        }),
      ),
    );

    const result = await new AnthropicClaudeReviewRunner({
      apiKey: "test-key",
      model: "claude-sonnet-test",
    }).review(evidence);

    expect(result).toEqual(needsFixReviewPacket);
    expect(result.codexFixBrief).toMatchObject({
      instructions: ["Move fix instructions under codexFixBrief.instructions."],
      summary: "Fix malformed Claude review packet output.",
    });
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
