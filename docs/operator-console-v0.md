# Operator Console v0

The Operator Console is the first browser-operated surface for the Agent Office. It is intentionally small: one operator, one Notion task, one preview, one explicit approval.

## Route

```text
GET /office
```

The page is public as a shell. It does not embed secrets or task data. Every operational API request from the page still calls `/agent-office/*` and must include `x-agent-office-api-key`.

## Desk Modes

The console supports these desk modes:

- Architecture Desk: list `Ready for Architecture` tasks, preview an Architect Brief, optionally revise the preview through feedback rounds, approve exact writeback, then move Status to `Ready for Codex`.
- Codex Handoff Desk: list `Ready for Codex` tasks, preview a Codex Handoff Brief, approve exact writeback, then move Status to `In Codex`.
- Implementation Ready: list `In Codex` tasks that already contain an approved `Codex Handoff Brief:` marker, then preview and approve an implementation work-order PR.
- Codex Dispatch: list implementation-ready tasks, preview a short `@codex` PR comment for an existing work-order PR/task, post it after explicit confirmation, record the comment URL/status to Notion, and refresh GitHub evidence for Codex responses or applied commits.

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
```

## Controlled Implementation Flow

```text
List In Codex tasks with approved Codex Handoff Brief markers
  -> load persisted handoff from Notion
  -> preview deterministic implementation work-order proposal
  -> review exact work-order file and draft PR body
  -> approve separate signed work-order token
  -> create/update implementation branch
  -> commit .agent-office/work-orders/<notion-task-id>.md
  -> open/update implementation-pending draft PR
  -> append work-order PR result and next Codex action to Notion
  -> Codex implements on the created product branch after this Office step
```

Approving the Codex Handoff Brief does not start coding. Approving the work-order PR also does not mean implementation is complete; it creates the branch and starting-point draft PR for Codex to implement on. The implementation lane has its own approval token that signs the exact repository, branch, base SHA, PR title/body, work-order path/content, task ID, and handoff summary. Loading a persisted Notion handoff is a v0 resume/recovery path; a durable structured proposal store can replace parser-based resume later.

## Codex Dispatch Flow

```text
List implementation-ready tasks
  -> enter the work-order repo and PR number
  -> preview deterministic @codex PR comment
  -> validate selected task, repo, branch, PR, and work-order file metadata
  -> review the exact comment and safety boundaries
  -> approve signed preview token
  -> post the @codex comment to the PR
  -> append comment URL and awaiting status to the Notion task
  -> refresh GitHub status until Codex response/review/task/commit evidence appears
```

Preview mode is side-effect-free: no Notion writes, GitHub comments, commits, or direct Codex execution. Record mode posts exactly the previewed GitHub `@codex` PR comment and records the comment URL/status only after explicit confirmation. The desk does not claim Codex completed work until GitHub evidence appears.

## Approval Token Contract

Preview responses include a signed approval token with a 120 minute expiry. The token contains:

- action, such as `architect-brief-writeback`, `codex-handoff-writeback`, `github-draft-pr-create`, `implementation-branch-draft-pr`, or `codex-dispatch-record`
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

Approval writes or executes the exact payload embedded in the token. It must not rerun the Architect Agent, rerun the Codex Handoff Agent, call the Implementation Agent for work-order preview, call OpenAI, or regenerate GitHub proposal content.

For Architecture Desk revisions, each revision response replaces the active preview and approval token in the UI. Intermediate previews are not written to Notion. Only the final submitted token is written back.

## Duplicate Guard

Before approved writeback, the API checks the task page for the relevant marker:

- `Architect Brief:` for Architecture Desk
- `Codex Handoff Brief:` for Implementation Desk
- `codex-dispatch:<repo>#<pr>:<head-sha>` for Codex Dispatch comment records

For GitHub Draft PR Prep, the GitHub service checks for duplicate branch/PR before creating the branch. For Controlled Implementation, the GitHub service creates or updates a scoped implementation branch and draft PR with only the approved work-order file, but never pushes to main, merges, deploys, changes protected repository paths, or edits product application files.

## Future Reuse

The same preview -> approve -> execute shape should be reused for future office actions:

- Codex implementation on the created product branch
- Claude review request
- deployment approval
- release note writeback

For larger future proposals, replace embedded signed payloads with a durable proposal store keyed by `proposalId`, then sign only the proposal metadata and hash.
