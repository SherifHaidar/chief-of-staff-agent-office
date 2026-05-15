# Operator Console v0

The Operator Console is the first browser-operated surface for the Agent Office. It is intentionally small: one operator, one Notion task, one Architect Brief preview, one explicit approval.

## Route

```text
GET /office
```

The page is public as a shell. It does not embed secrets or task data. Every operational API request from the page still calls `/agent-office/*` and must include `x-agent-office-api-key`.

## Flow

```text
List Ready for Architecture tasks
  -> preview Architect Brief
  -> review exact structured brief
  -> approve signed preview token
  -> append exact approved brief to Notion
  -> update Status to Ready for Codex
  -> record run summary
```

## Approval Token Contract

Preview responses include a signed approval token with a 120 minute expiry. The token contains:

- action: `architect-brief-writeback`
- task page ID
- optional task name
- exact structured `ArchitectBrief`
- brief hash
- preview run ID
- target status after writeback
- created and expiry timestamps

The approval endpoint requires both:

- a valid `x-agent-office-api-key`
- a valid, untampered, unexpired approval token

Approval writes the exact brief embedded in the token. It must not rerun the Architect Agent or call OpenAI.

## Duplicate Guard

Before approved writeback, the API checks the task page for the existing `Architect Brief:` marker. If the marker is present, the writeback is skipped and a skipped run summary is recorded.

## Future Reuse

The same preview -> approve -> execute shape should be reused for future office actions:

- Codex handoff proposal
- Claude review request
- deployment approval
- release note writeback
- GitHub PR or branch coordination

For larger future proposals, replace embedded signed payloads with a durable proposal store keyed by `proposalId`, then sign only the proposal metadata and hash.
