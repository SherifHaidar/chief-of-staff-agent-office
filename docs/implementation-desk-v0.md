# Implementation Desk v0

The Implementation Desk is the first Agent Office layer after Architecture. It turns a Notion task that is already `Ready for Codex` into an implementation-ready Codex Handoff Brief for the Chief of Staff product repo.

It does not create GitHub issues, branches, commits, pull requests, deployments, or Codex tasks yet. It prepares the exact handoff that a future GitHub/Codex integration can use after human approval.

## Flow

```text
Ready for Codex task
  -> generate Codex Handoff Brief preview
  -> sign the exact structured handoff
  -> human approves the signed preview
  -> append that exact handoff to the same Notion task page
  -> update Status to In Codex after successful append
  -> record run summary
```

## Codex Handoff Brief Contents

The structured handoff includes:

- target product repo
- problem summary
- product intent
- implementation scope
- likely affected files or modules, if known
- constraints and do-not-change guidance
- implementation steps
- tests to run
- acceptance checklist
- suggested branch name
- suggested PR title
- suggested PR body
- explicit merge and deployment approval warnings

## Approval Contract

Preview responses include a signed approval token with a 120 minute expiry. The token embeds the exact structured `CodexHandoffBrief`, its hash, the target task page ID, target product repo, preview run ID, and optional status to apply after writeback.

The approval endpoint requires both:

- a valid `x-agent-office-api-key`
- a valid, untampered, unexpired approval token

Approval writes the exact handoff embedded in the token. It must not rerun the model or call OpenAI.

## Notion Write Contract

The Implementation Desk may only write to Notion during approved writeback:

1. Append `Codex Handoff Brief:` blocks to the same task page.
2. Update Status to the configured `NOTION_STATUS_AFTER_CODEX_HANDOFF`, usually `In Codex`, only after the append succeeds.

If writeback fails, status must not advance. If the task page already contains a `Codex Handoff Brief:` marker, approved writeback is skipped to avoid duplicate handoffs.

## API Surface

```text
GET /agent-office/tasks/ready-for-codex
POST /agent-office/codex-handoff
POST /agent-office/codex-handoff/approve
```

All routes require `x-agent-office-api-key`.

## Operator Console

`GET /office` now has two desk modes:

- Architecture Desk: `Ready for Architecture` -> Architect Brief -> `Ready for Codex`
- Implementation Desk: `Ready for Codex` -> Codex Handoff Brief -> `In Codex`

Both modes use the same preview -> approve -> exact writeback pattern.

## Next Extension

The next PR can turn an approved Codex Handoff Brief into a GitHub issue, branch plan, or Codex implementation task. That future step should consume the reviewed handoff rather than regenerating it.
