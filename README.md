# chief-of-staff-agent-office

Standalone AI Development Office Orchestrator for the personal Chief of Staff product.

This repository owns orchestration only. It does not clone, modify, merge, or deploy product code. It coordinates controlled office workflows around Notion tasks, previews proposed agent outputs, and writes back only after explicit approval.

## Current Workflows

```text
Ready for Architecture task
  -> Architect Agent preview
  -> signed approval
  -> exact Architect Brief writeback
  -> Status: Ready for Codex
```

```text
Ready for Codex task
  -> Implementation Desk / Codex Handoff preview
  -> signed approval
  -> exact Codex Handoff Brief writeback
  -> Status: In Codex
```

The longer-term goal is an AI Development Office that can coordinate architecture, implementation planning, review, QA, release notes, GitHub/Vercel coordination, and human approval gates.

## Docs

- [Notion Operating Contract](docs/notion-operating-contract.md)
- [Operator Console v0](docs/operator-console-v0.md)
- [Implementation Desk v0](docs/implementation-desk-v0.md)

## Quick Start

```bash
npm install
cp .env.example .env
npm run architect -- --page-id <notion-page-id> --dry-run
```

Start the local API server:

```bash
npm run server
```

For development with file watching:

```bash
npm run dev
```

The server listens on `127.0.0.1:3000` by default. You can override this with `HOST` and `PORT`.

## Operator Console

Open:

```text
/office
```

The page is public as a shell, but every `/agent-office/*` request it makes requires `x-agent-office-api-key`. It supports:

- Architecture Desk: list `Ready for Architecture` tasks, preview Architect Briefs, approve exact writeback.
- Implementation Desk: list `Ready for Codex` tasks, preview Codex Handoff Briefs, approve exact writeback.

Approval tokens expire after 120 minutes. Approval endpoints write the exact previewed payload embedded in the signed token and do not rerun the model.

## HTTP API

Health is public:

```bash
curl http://127.0.0.1:3000/health
```

All Agent Office routes require:

```bash
-H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY"
```

List architecture-ready tasks:

```bash
curl http://127.0.0.1:3000/agent-office/tasks/ready-for-architecture \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY"
```

Preview an Architect Brief:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>","dryRun":true}'
```

Approve exact Architect Brief writeback:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review/approve \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"approvalToken":"<approval-token-from-preview>"}'
```

List Codex-ready tasks:

```bash
curl http://127.0.0.1:3000/agent-office/tasks/ready-for-codex \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY"
```

Preview a Codex Handoff Brief:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/codex-handoff \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>"}'
```

Approve exact Codex Handoff writeback:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/codex-handoff/approve \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"approvalToken":"<approval-token-from-preview>"}'
```

Batch dry-run architecture-ready tasks:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/run-ready-architecture \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"dryRun":true}'
```

## Configuration

Required for live API use:

- `OPENAI_API_KEY`
- `NOTION_TOKEN`
- `NOTION_TASK_DATABASE_ID`
- `AGENT_OFFICE_API_KEY`
- `AGENT_OFFICE_APPROVAL_SECRET`

Recommended explicit configuration:

- `OPENAI_MODEL=gpt-5.4`
- `NOTION_STATUS_PROPERTY=Status`
- `NOTION_STATUS_PROPERTY_TYPE=select`
- `NOTION_READY_FOR_ARCHITECTURE_STATUS=Ready for Architecture`
- `NOTION_READY_FOR_CODEX_STATUS=Ready for Codex`
- `NOTION_STATUS_AFTER_ARCHITECT=Ready for Codex`
- `NOTION_STATUS_AFTER_CODEX_HANDOFF=In Codex`
- `TARGET_PRODUCT_REPO=<owner/product-repo>`
- `RUN_LOG_PATH=data/run-log.jsonl`

Use long random values for `AGENT_OFFICE_API_KEY` and `AGENT_OFFICE_APPROVAL_SECRET`. The approval secret signs short-lived approval tokens and should be different from the API key.

The Notion integration must be able to read the AI Build Tasks database, read task page content, append blocks to task pages, and update the configured status property.

## Vercel

The repo includes explicit Vercel function entrypoints under `api/` and rewrites in `vercel.json`. Deployed public routes match local routes:

```text
/health
/office
/agent-office/*
```

On Vercel, the adapter defaults `RUN_LOG_PATH` to `/tmp/agent-office-run-log.jsonl` when the variable is not set. Treat `/tmp` and hosted JSONL logs as ephemeral; use structured API responses and Vercel function logs until a durable run store exists.

## Safety Model

Agents do not receive tools that mutate external systems. They only return structured outputs. The TypeScript workflow layer owns side effects and performs Notion writes in a fixed order.

Dry-run and preview steps do not write to Notion. Approved writeback appends to the same task page first and updates status only after append succeeds. Duplicate guards check for existing `Architect Brief:` and `Codex Handoff Brief:` markers before approved writeback.

GitHub issues, branches, PRs, Codex implementation tasks, Claude review, merge, and deployment automation are intentionally out of scope until a future approved workflow adds them.
