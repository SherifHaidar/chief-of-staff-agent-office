# Operator Console v0

The Operator Console is the first browser-operated surface for the Agent Office. It is intentionally small: one operator, one Notion task, one preview, one explicit approval.

## Route

```text
GET /office
```

The page is public as a shell. It does not embed secrets or task data. Every operational API request from the page still calls `/agent-office/*` and must include `x-agent-office-api-key`.

## Desk Modes

The console supports two desk modes:

- Architecture Desk: list `Ready for Architecture` tasks, preview an Architect Brief, approve exact writeback, then move Status to `Ready for Codex`.
- Implementation Desk: list `Ready for Codex` tasks, preview a Codex Handoff Brief, approve exact writeback, then move Status to `In Codex` when configured.

## Architecture Flow

```text
List Ready for Architecture tasks
  -> preview Architect Brief
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
  -> record run summary
```

## Approval Token Contract

Preview responses include a signed approval token with a 120 minute expiry. The token contains:

- action, such as `architect-brief-writeback` or `codex-handoff-writeback`
- task page ID
- optional task name
- exact structured preview payload
- payload hash
- preview run ID
- target status after writeback
- created and expiry timestamps

The approval endpoint requires both:

- a valid `x-agent-office-api-key`
- a valid, untampered, unexpired approval token

Approval writes the exact payload embedded in the token. It must not rerun the Architect Agent, rerun the Codex Handoff Agent, or call OpenAI.

## Duplicate Guard

Before approved writeback, the API checks the task page for the relevant marker:

- `Architect Brief:` for Architecture Desk
- `Codex Handoff Brief:` for Implementation Desk

If the marker is present, the writeback is skipped and a skipped run summary is recorded.

## Future Reuse

The same preview -> approve -> execute shape should be reused for future office actions:

- GitHub issue creation from an approved handoff
- Codex implementation task creation
- Claude review request
- deployment approval
- release note writeback

For larger future proposals, replace embedded signed payloads with a durable proposal store keyed by `proposalId`, then sign only the proposal metadata and hash.
