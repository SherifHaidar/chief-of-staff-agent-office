# Architecture Desk Revision Loop v0

Architecture Desk Revision Loop v0 lets Sherif revise an Architect Brief preview before approving Notion writeback.

The loop is intentionally proposal-based:

```text
Preview v1
  -> signed approval token v1
  -> Sherif feedback
  -> revised preview v2
  -> signed approval token v2
  -> more feedback if needed
  -> revised preview v3
  -> approve latest token
  -> write exact approved brief to Notion
```

Intermediate previews are not written to Notion. Approval writes only the Architect Brief embedded in the submitted signed token.

## Inputs

Each revision uses:

- current AI Build Task content
- current task child content already available to the Notion reader
- Product Context Pack, when configured
- previous Architect Brief from the signed approval token
- Sherif's revision feedback

The browser does not send the previous brief directly. It sends the previous signed approval token, and the server verifies that token before extracting the previous brief.

## Multiple Feedback Rounds

Every revision creates a new approval token with an incremented revision number.

The Operator Console replaces the active preview/token after each revision:

- v1 token is replaced by v2
- v2 token is replaced by v3
- approval should use the latest displayed token

There is no durable proposal store yet, so older unexpired tokens are not server-invalidated. The UI keeps only the latest token active. A future proposal store can enforce latest-token-only approval across sessions.

## Writeback Metadata

Approved Architecture writeback includes:

- latest approved Architect Brief marker
- approval timestamp
- revision number
- Architecture disposition:
  - `Ready for Codex`
  - `Needs Owner Decisions`
- final approved brief content
- owner decision notes from open questions and context gaps
- context gaps from the Product Context Pack

The disposition is derived from the final approved brief and Product Context Pack summary. Open questions or context gaps mark the writeback as `Needs Owner Decisions`; otherwise it is `Ready for Codex`.

## API

```text
POST /agent-office/architect-review/revise
```

Request:

```json
{
  "taskId": "notion-page-id",
  "previousApprovalToken": "signed-preview-token",
  "revisionFeedback": "Tighten scope and call out remaining owner decisions."
}
```

Response includes the revised brief, a new approval token, revision metadata, run summary, and Product Context Pack summary when available.

All `/agent-office/*` routes require `x-agent-office-api-key`.

## Logging

Revision runs are logged as `architect-review-revision`.

Run summaries include:

- task ID/name
- revision number
- previous preview run ID
- revision feedback hash
- success/failure
- whether Notion writeback happened

Raw revision feedback is not written to logs.

## Future Reuse

The same pattern can be reused by later desks:

- Codex Handoff revisions
- GitHub Draft PR Proposal revisions
- Claude Review request revisions
- release note revisions

If proposal payloads become too large or multi-operator review becomes important, replace embedded signed payloads with a durable proposal store keyed by `proposalId`.
