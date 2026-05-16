# Implementation Desk v0

The Implementation Desk is the Agent Office layer after Architecture. It turns a Notion task that is already `Ready for Codex` into implementation-ready work for the Chief of Staff product repo.

It now has three controlled stages:

1. Generate and approve a Codex Handoff Brief.
2. From that approved handoff, preview and approve a GitHub Draft PR Prep action.
3. From an `In Codex` task with an approved handoff, preview and approve Controlled Implementation.

Codex Handoff approval still does not edit product code, merge, deploy, or change repository settings/secrets. Controlled Implementation can edit product code only after its separate exact proposal approval.

## Flow

```text
Ready for Codex task
  -> generate Codex Handoff Brief preview
  -> sign the exact structured handoff
  -> human approves the signed preview
  -> append that exact handoff to the same Notion task page
  -> update Status to In Codex after successful append
  -> preview GitHub Draft PR Proposal
  -> human approves the signed GitHub proposal
  -> create agent-office/* branch in the product repo
  -> commit .agent-office/handoffs/<notion-task-id>.md
  -> open draft PR against main
  -> append GitHub PR result to the Notion task
```

```text
In Codex task with Codex Handoff Brief marker
  -> load the persisted handoff from Notion
  -> preview Controlled Implementation Proposal
  -> human approves the signed implementation proposal
  -> create/update allowlisted implementation branch
  -> commit exact approved product file changes
  -> open/update draft PR against main
  -> append implementation PR/evidence result to the Notion task
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

When `PRODUCT_CONTEXT_PAGE_ID` is configured, the handoff agent receives the shared Product Context Pack before generation. The handoff should use actual product context, inspected repo files, fragile areas, and do-not-break flows. If the pack reports gaps, the handoff should surface them instead of pretending the repo was fully inspected.

## Approval Contract

Preview responses include signed approval tokens with a 120 minute expiry.

Codex Handoff approval writes the exact handoff embedded in the token. It must not rerun the model or call OpenAI.

GitHub Draft PR approval writes the exact GitHub proposal embedded in the token. It must not regenerate the proposal, change branch names, change file content, or alter PR text during execution.

Controlled Implementation approval writes the exact implementation proposal embedded in the token. Resuming from a persisted Notion handoff is a v0 recovery path for tasks already in `In Codex`; it should be replaced by a durable structured proposal store later.

## Notion Write Contract

The Implementation Desk may write to Notion only after approved actions:

1. Append `Codex Handoff Brief:` blocks to the same task page.
2. Update Status to the configured `NOTION_STATUS_AFTER_CODEX_HANDOFF`, usually `In Codex`, only after the handoff append succeeds.
3. Append `GitHub Draft PR:` blocks with PR URL, branch, commit SHA, base branch, and handoff file path only after GitHub branch/commit/draft PR creation succeeds.

If writeback fails, status must not advance. If the task page already contains a `Codex Handoff Brief:` marker, approved handoff writeback is skipped to avoid duplicate handoffs.

## API Surface

```text
GET /agent-office/tasks/ready-for-codex
POST /agent-office/codex-handoff
POST /agent-office/codex-handoff/approve
GET /agent-office/tasks/implementation-ready
POST /agent-office/github/draft-pr
POST /agent-office/github/draft-pr/approve
POST /agent-office/github/implementation
POST /agent-office/github/implementation/approve
```

All routes require `x-agent-office-api-key`.

## Operator Console

`GET /office` has three desk modes:

- Architecture Desk: `Ready for Architecture` -> Architect Brief -> `Ready for Codex`
- Codex Handoff Desk: `Ready for Codex` -> Codex Handoff Brief -> `In Codex`
- Implementation Ready: `In Codex` + `Codex Handoff Brief:` -> Controlled Implementation Preview -> Implementation Draft PR

All modes use preview -> approve -> exact execution.
