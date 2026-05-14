# chief-of-staff-agent-office

Standalone AI Development Office Orchestrator for a personal Chief of Staff product.

This repository owns orchestration only. It does not connect to, clone, or modify the product codebase. v0 proves one controlled workflow:

```text
Notion AI Build Task
  -> Architect Agent
  -> Architect Brief appended to the same Notion task
  -> Notion task status update
```

The long-term shape is an office-like system where specialized AI agents can help with architecture, implementation planning, review, QA, release notes, and eventually GitHub/Vercel coordination while the human remains the final approver.

## Notion Operating Contract

The Notion-side board contract is documented in [docs/notion-operating-contract.md](docs/notion-operating-contract.md). Treat that spec as the integration contract for AI Build Tasks, Build Room Dashboard views, status transitions, duplicate-processing policy, and human approval gates.

## v0 Scope

Input:

```text
Notion task page ID or scanned Ready for Architecture tasks
```

Action:

1. Fetch the Notion task page and its body content.
2. Run a single Architect Agent with structured output.
3. Render the Architect Brief into Notion blocks.
4. Append the brief to the same page.
5. Update the task status after successful writeback.
6. Record a lightweight run summary for traceability.

Output:

```text
A clear JSON success/failure result from the CLI or HTTP API.
```

## Quick Start

```bash
npm install
cp .env.example .env
npm run architect -- --page-id <notion-page-id>
```

Dry run without writing to Notion:

```bash
npm run architect -- --page-id <notion-page-id> --dry-run
```

## HTTP API

Start the local Agent Office API server:

```bash
npm run server
```

For development with file watching:

```bash
npm run dev
```

The server listens on `127.0.0.1:3000` by default. You can override this with `HOST` and `PORT` environment variables.

### Health Check

The health endpoint is intentionally public and generic.

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{
  "ok": true,
  "service": "chief-of-staff-agent-office",
  "status": "healthy"
}
```

### API Authentication

All `/agent-office/*` endpoints require an API key. Set `AGENT_OFFICE_API_KEY` in `.env` and send it with the `x-agent-office-api-key` header:

```bash
export AGENT_OFFICE_API_KEY="<your-local-api-key>"
```

Requests with a missing or invalid key return:

```json
{
  "ok": false,
  "error": "Unauthorized."
}
```

### List Ready Architecture Tasks

Returns Notion AI Build Tasks where the configured Status property equals `Ready for Architecture`.

```bash
curl http://127.0.0.1:3000/agent-office/tasks/ready-for-architecture \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY"
```

Expected shape:

```json
{
  "ok": true,
  "tasks": [
    {
      "taskId": "<notion-page-id>",
      "name": "Example task",
      "status": "Ready for Architecture",
      "priority": "High"
    }
  ]
}
```

### Run Ready Architecture Tasks

Dry-run every task currently marked `Ready for Architecture`:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/run-ready-architecture \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"dryRun":true}'
```

Real writeback for every task currently marked `Ready for Architecture`:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/run-ready-architecture \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"dryRun":false}'
```

Expected summary shape:

```json
{
  "ok": true,
  "dryRun": true,
  "summary": {
    "processed": 1,
    "skipped": 0,
    "failed": 0
  },
  "processed": [],
  "skipped": [],
  "failed": [],
  "runs": []
}
```

For real runs, the API checks whether the task page already contains an `Architect Brief:` marker before invoking the workflow. If it does, that task is skipped to avoid duplicate writebacks.

### Architect Review Dry Run

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>","dryRun":true}'
```

Expected shape:

```json
{
  "ok": true,
  "taskId": "<notion-page-id>",
  "dryRun": true,
  "statusUpdated": false,
  "briefGenerated": true,
  "run": {
    "runId": "run_...",
    "workflow": "architect-review",
    "taskId": "<notion-page-id>",
    "dryRun": true,
    "outcome": "succeeded",
    "briefGenerated": true,
    "notionWriteback": false,
    "statusUpdated": false,
    "startedAt": "2026-05-14T12:00:00.000Z",
    "finishedAt": "2026-05-14T12:00:01.000Z"
  }
}
```

### Architect Review Writeback

Only run this after the dry run looks correct:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>","dryRun":false}'
```

A successful real writeback appends the Architect Brief to the same Notion page and updates the configured status property after the append succeeds.

## Vercel Deployment Preparation

This repo includes a thin Vercel function adapter at `api/[...path].ts` and minimal rewrites in `vercel.json`. The deployed public routes stay the same as local development:

```text
/health
/agent-office/*
```

The core Fastify app remains portable in `src/server/app.ts`. Local Node hosting still starts through `src/server/server.ts`, while Vercel requests are injected into the same Fastify app without calling `listen()`.

This repository does not include deployment automation yet. Connect the GitHub repo to Vercel or deploy manually only after reviewing the safety checklist.

### Vercel Environment Variables

Required Vercel environment variables:

- `OPENAI_API_KEY`
- `NOTION_TOKEN`
- `NOTION_TASK_DATABASE_ID`
- `AGENT_OFFICE_API_KEY`

Recommended explicit Vercel environment variables:

- `OPENAI_MODEL=gpt-5.4`
- `NOTION_STATUS_PROPERTY=Status`
- `NOTION_STATUS_PROPERTY_TYPE=select`
- `NOTION_READY_FOR_ARCHITECTURE_STATUS=Ready for Architecture`
- `NOTION_STATUS_AFTER_ARCHITECT=Ready for Codex`
- `NOTION_MAX_READ_DEPTH=3`
- `RUN_LOG_PATH=/tmp/agent-office-run-log.jsonl`
- `DRY_RUN=false`
- `LOG_LEVEL=info`

Use a long random value for `AGENT_OFFICE_API_KEY`. Do not expose it in frontend code, commit it to Git, or paste it into Notion task content.

For runtime parity with CI, use Node.js 20 or newer. Node 20 is the current CI baseline.

### Vercel Smoke Tests

Set local shell variables first:

```bash
export DEPLOYMENT_URL="https://<your-vercel-deployment-url>"
export AGENT_OFFICE_API_KEY="<your-agent-office-api-key>"
```

Check public health:

```bash
curl "$DEPLOYMENT_URL/health"
```

Expected: `ok: true` and no sensitive configuration values.

Confirm protected routes reject missing API keys:

```bash
curl -i "$DEPLOYMENT_URL/agent-office/tasks/ready-for-architecture"
```

Expected: HTTP `401` with `{ "ok": false, "error": "Unauthorized." }`.

Confirm protected routes accept the configured API key:

```bash
curl "$DEPLOYMENT_URL/agent-office/tasks/ready-for-architecture" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY"
```

Expected: HTTP `200` with `{ "ok": true, "tasks": [...] }`.

Run the first live Architect review as a dry-run against one safe Notion test task:

```bash
curl -X POST "$DEPLOYMENT_URL/agent-office/architect-review" \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<safe-test-notion-page-id>","dryRun":true}'
```

Expected: `ok: true`, `briefGenerated: true`, `dryRun: true`, `statusUpdated: false`, and `run.notionWriteback: false`. After the dry-run, inspect the Notion task and confirm that no Architect Brief was appended and the Status did not change.

## Run Log

The API records one JSON object per Architect workflow run to the configured JSONL file. By default for local development:

```text
data/run-log.jsonl
```

Each line is a run summary with:

- `runId`
- `workflow`
- `taskId` and optional `taskName`
- `dryRun`
- `outcome`: `succeeded`, `failed`, or `skipped`
- `briefGenerated`
- `notionWriteback`
- `statusUpdated`
- `error` or `reason`, when applicable
- `startedAt` and `finishedAt`

Inspect it locally with:

```bash
tail -n 20 data/run-log.jsonl
```

The run log is intentionally local and append-only for now. It is not committed to Git and is not a Notion database. On Vercel, the adapter defaults `RUN_LOG_PATH` to `/tmp/agent-office-run-log.jsonl` when the variable is not set. Treat `/tmp` and all hosted JSONL logs as ephemeral; use structured API responses and Vercel function logs for initial live traceability until a durable run store exists.

## Configuration

See `.env.example` for required values. For the default v0 workflow:

- `AGENT_OFFICE_API_KEY` is required to start the HTTP API server and must be sent as `x-agent-office-api-key` for every `/agent-office/*` request.
- `NOTION_TASK_DATABASE_ID` should be the AI Build Tasks database ID.
- `NOTION_STATUS_PROPERTY_TYPE` should match the Notion property type for the configured status property. The current AI Build Tasks board uses `select`; use `status` only if the Notion property is converted to a native Notion status property.
- `NOTION_READY_FOR_ARCHITECTURE_STATUS` should match the exact Notion status option used for tasks awaiting architecture review, usually `Ready for Architecture`.
- `NOTION_STATUS_AFTER_ARCHITECT` should match the exact Notion status option you want after writeback, usually `Ready for Codex`.
- `RUN_LOG_PATH` should point to the local JSONL audit file, usually `data/run-log.jsonl`. On Vercel, use `/tmp/agent-office-run-log.jsonl` and treat it as ephemeral.

The Notion integration must have permission to read the task database, read task page content, append blocks, and update the configured status property.

## Deployment Safety Checklist

Before any hosted deployment:

1. Configure `OPENAI_API_KEY`, `NOTION_TOKEN`, `NOTION_TASK_DATABASE_ID`, and `AGENT_OFFICE_API_KEY` as platform-managed environment variables or secrets.
2. Use a long random `AGENT_OFFICE_API_KEY`; do not expose it in frontend code or commit it to Git.
3. Confirm the Notion integration is scoped only to the intended AI Build Tasks database and task pages.
4. Keep `/health` public but generic; all `/agent-office/*` routes must require the API key.
5. On Vercel, set `RUN_LOG_PATH` to `/tmp/agent-office-run-log.jsonl` or rely on the adapter default, and do not treat it as durable storage.
6. Run a live dry-run against one safe test task before any real writeback.
7. Run the first real writeback against one safe test task only after the dry-run output looks correct.
8. Confirm the Architect Brief was appended and `Status` moved to `Ready for Codex`.
9. Treat structured API responses and hosted platform logs as the first live traceability layer. Do not rely on local JSONL logs as durable hosted audit storage without a persistent volume or future database-backed run log.

## Safety Model

The Architect Agent does not receive tools that can mutate external systems. It only returns a structured `ArchitectBrief`. The TypeScript workflow owns side effects and performs Notion writes in a fixed order.

The HTTP API is intentionally thin: it validates requests, authorizes Agent Office routes, calls the existing workflow layer, records run summaries, and returns JSON. It does not duplicate Notion write logic.

The Ready for Architecture scanner only queries Notion and returns task metadata. Batch-running ready tasks still delegates each task to the existing Architect workflow.

This keeps the v0 path simple while leaving room for later approval gates, additional agent roles, GitHub/Vercel coordination, Claude review, Codex handoff, QA, and release-note workflows.
