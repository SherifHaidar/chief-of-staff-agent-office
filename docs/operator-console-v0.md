# Operator Console v0

The Operator Console is the first browser-operated surface for the Agent Office. It is intentionally small: one operator, one Notion task, one preview, one explicit approval.

## Route

```text
GET /office
```

The page is public as a shell. It does not embed secrets or task data. Every operational API request from the page still calls `/agent-office/*` and must include `x-agent-office-api-key`.

## Desk Modes

The console supports two desk modes:

- Architecture Desk: list `Ready for Architecture` tasks, preview an Architect Brief, optionally revise the preview through feedback rounds, approve exact writeback, then move Status to `Ready for Codex`.
- Implementation Desk: list `Ready for Codex` tasks, preview a Codex Handoff Brief, approve exact writeback, then optionally preview and approve GitHub Draft PR Prep or Controlled Implementation.

Preview cards show whether the shared Product Context Pack was included. This tells the operator whether the agent used Notion product context and bounded GitHub repo context before generating the brief or handoff.

## Architecture Flow

```text
List Ready for Architecture tasks
  -> preview Architect Brief
  -> optionally provide revision feedback
  -> generate revised preview with a new signed token
  -> repeat until satisfied
  -> review exact structured brief
  -> approve signed preview token
  -> append exact approved brief to Notion
  -> update Status to Ready for Codex
  -> record run summary
```

## Implementation Flow

```text
List Ready for Codex tasks
  -> preview Codex Handoff Brief
  -> review exact structured handoff
  -> approve signed preview token
  -> append exact approved handoff to Notion
  -> update Status to In Codex
  -> preview GitHub Draft PR Proposal
  -> review exact branch/file/PR proposal
  -> approve signed GitHub proposal token
  -> create branch, commit handoff file, open draft PR
  -> append GitHub result to Notion
```

## Controlled Implementation Flow

```text
Approved Codex Handoff Brief
  -> preview Controlled Implementation Proposal
  -> review exact proposed files and task-specific verification plan
  -> approve separate signed implementation token
  -> create/update implementation branch
  -> commit exact approved file changes
  -> open/update draft PR
  -> capture available GitHub check evidence
  -> append implementation result to Notion
```

Approving the Codex Handoff Brief does not start coding. The implementation lane has its own approval token that signs the exact file changes.

## Approval Token Contract

Preview responses include a signed approval token with a 120 minute expiry. The token contains:

- action, such as `architect-brief-writeback`, `codex-handoff-writeback`, `github-draft-pr-create`, or `implementation-branch-draft-pr`
- task page ID
- optional task name
- exact structured preview payload
- payload hash
- preview run ID
- revision number for revised Architecture previews
- previous preview run ID and revision feedback hash when applicable
- target status or GitHub write metadata
- created and expiry timestamps

The approval endpoint requires both:

- a valid `x-agent-office-api-key`
- a valid, untampered, unexpired approval token

Approval writes or executes the exact payload embedded in the token. It must not rerun the Architect Agent, rerun the Codex Handoff Agent, rerun the Implementation Agent, call OpenAI, or regenerate GitHub proposal content.

For Architecture Desk revisions, each revision response replaces the active preview and approval token in the UI. Intermediate previews are not written to Notion. Only the final submitted token is written back.

## Duplicate Guard

Before approved writeback, the API checks the task page for the relevant marker:

- `Architect Brief:` for Architecture Desk
- `Codex Handoff Brief:` for Implementation Desk

For GitHub Draft PR Prep, the GitHub service checks for duplicate branch/PR before creating the branch. For Controlled Implementation, the GitHub service creates or updates a scoped implementation branch and draft PR, but never pushes to main, merges, deploys, or changes protected repository paths.

## Future Reuse

The same preview -> approve -> execute shape should be reused for future office actions:

- Codex implementation diff creation
- Claude review request
- deployment approval
- release note writeback

For larger future proposals, replace embedded signed payloads with a durable proposal store keyed by `proposalId`, then sign only the proposal metadata and hash.
