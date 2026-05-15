# chief-of-staff-agent-office

Standalone AI Development Office Orchestrator for a personal Chief of Staff product.

This repository owns orchestration only. It does not connect to, clone, or modify the product codebase. v0 proves one controlled workflow:

```text
Notion AI Build Task
  -> Architect Agent
  -> Architect Brief preview
  -> Human approval
  -> Exact approved Architect Brief appended to the same Notion task
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
3. Preview the exact generated Architect Brief.
4. Sign a short-lived approval token for that exact brief.
5. Append the approved brief to the same page without rerunning the model.
6. Update the task status after successful writeback.
7. Record a lightweight run summary for traceability.

Output:

```text
A clear JSON success/failure result from the CLI, HTTP API, or Operator Console.
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

### Operator Console

The Operator Console is available at:

```text
/office
```

It is a simple operational shell for the single-task Architect flow:

1. Enter the `x-agent-office-api-key` value.
2. Load tasks marked `Ready for Architecture`.
3. Preview one Architect Brief.
4. Review the exact generated brief and expiry time.
5. Approve writeback for that exact brief.

The page itself is public, but every `/agent-office/*` request it makes still requires the API key. Approval also requires a valid signed approval token.

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

### Architect Brief Preview

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>","dryRun":true}'
```

A successful preview returns the generated `brief` plus an `approval` token. The token expires after 120 minutes.

```json
{
  "ok": true,
  "taskId": "<notion-page-id>",
  "dryRun": true,
  "statusUpdated": false,
  "briefGenerated": true,
  "brief": {
    "briefTitle": "..."
  },
  "approval": {
    "action": "architect-brief-writeback",
    "token": "...",
    "briefHash": "...",
    "previewRunId": "run_...",
    "expiresAt": "2026-05-15T14:00:00.000Z"
  },
  "run": {
    "runId": "run_...",
    "workflow": "architect-review",
    "taskId": "<notion-page-id>",
    "dryRun": true,
    "outcome": "succeeded",
    "briefGenerated": true,
    "notionWriteback": false,
    "statusUpdated": false
  }
}
```

### Approve Architect Brief Writeback

Approval writes the exact previewed brief from the signed token. It does not rerun the Architect Agent or call OpenAI.

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review/approve \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"approvalToken":"<approval-token-from-preview>"}'
```

A successful approval appends the Architect Brief to the same Notion page and updates the configured status property after the append succeeds. The endpoint rejects missing, invalid, tampered, or expired approval tokens.

### Architect Review Writeback

The legacy direct writeback path remains available, but the Operator Console uses preview approval instead so the written brief is exactly what the operator reviewed.

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>","dryRun":false}'
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

For real runs, the API checks whether the task page already contains an `Architect Brief:` marker before invoking the workflow. If it does, that task is skipped to avoid duplicate writebacks.

## Vercel Deployment Preparation

This repo includes explicit Vercel function entrypoints under `api/` and minimal rewrites in `vercel.json`. The deployed public routes stay the same as local development:

```text
/health
/office
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
- `AGENT_OFFICE_APPROVAL_SECRET`

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

Use long random values for `AGENT_OFFICE_API_KEY` and `AGENT_OFFICE_APPROVAL_SECRET`. Do not expose either one in frontend code, commit them to Git, or paste them into Notion task content. The approval secret signs short-lived approval tokens and should be different from the API key.

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

Open the Operator Console:

```text
https://<your-vercel-deployment-url>/office
```

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

Expected: `ok: true`, `briefGenerated: true`, `dryRun: true`, `statusUpdated: false`, `run.notionWriteback: false`, a visible `brief`, and an `approval.expiresAt` about 120 minutes in the future. After the dry-run, inspect the Notion task and confirm that no Architect Brief was appended and the Status did not change.

Only after the preview looks correct, approve using the returned token or the `/office` console. Confirm the exact reviewed brief was appended and `Status` moved to `Ready for Codex`.

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
- `AGENT_OFFICE_APPROVAL_SECRET` is required to sign and verify Architect Brief approval tokens. Use a long random value that is different from `AGENT_OFFICE_API_KEY`.
- `NOTION_TASK_DATABASE_ID` should be the AI Build Tasks database ID.
- `NOTION_STATUS_PROPERTY_TYPE` should match the Notion property type for the configured status property. The current AI Build Tasks board uses `select`; use `status` only if the Notion property is converted to a native Notion status property.
- `NOTION_READY_FOR_ARCHITECTURE_STATUS` should match the exact Notion status option used for tasks awaiting architecture review, usually `Ready for Architecture`.
- `NOTION_STATUS_AFTER_ARCHITECT` should match the exact Notion status option you want after writeback, usually `Ready for Codex`.
- `RUN_LOG_PATH` should point to the local JSONL audit file, usually `data/run-log.jsonl`. On Vercel, use `/tmp/agent-office-run-log.jsonl` and treat it as ephemeral.

The Notion integration must have permission to read the task database, read task page content, append blocks, and update the configured status property.

## Deployment Safety Checklist

Before any hosted deployment:

1. Configure `OPENAI_API_KEY`, `NOTION_TOKEN`, `NOTION_TASK_DATABASE_ID`, `AGENT_OFFICE_API_KEY`, and `AGENT_OFFICE_APPROVAL_SECRET` as platform-managed environment variables or secrets.
2. Use long random values for Agent Office secrets; do not expose them in frontend code or commit them to Git.
3. Confirm the Notion integration is scoped only to the intended AI Build Tasks database and task pages.
4. Keep `/health` and `/office` public but generic; all `/agent-office/*` routes must require the API key.
5. On Vercel, set `RUN_LOG_PATH` to `/tmp/agent-office-run-log.jsonl` or rely on the adapter default, and do not treat it as durable storage.
6. Run a live dry-run against one safe test task before any real writeback.
7. Approve the first real writeback against one safe test task only after the preview output looks correct.
8. Confirm the exact approved Architect Brief was appended and `Status` moved to `Ready for Codex`.
9. Treat structured API responses and hosted platform logs as the first live traceability layer. Do not rely on local JSONL logs as durable hosted audit storage without a persistent volume or future database-backed run log.

## Safety Model

The Architect Agent does not receive tools that can mutate external systems. It only returns a structured `ArchitectBrief`. The TypeScript workflow owns side effects and performs Notion writes in a fixed order.

The Operator Console uses a preview -> signed approval token -> execute flow. The preview step runs the model once. The approval step verifies the API key and approval token, then writes the exact structured brief embedded in that token. It does not rerun the model.

The HTTP API is intentionally thin: it validates requests, authorizes Agent Office routes, calls the existing workflow layer, records run summaries, and returns JSON. It does not duplicate Notion write logic.

The Ready for Architecture scanner only queries Notion and returns task metadata. Batch-running ready tasks still delegates each task to the existing Architect workflow.

This keeps the v0 path simple while leaving room for later approval gates, additional agent roles, GitHub/Vercel coordination, Claude review, Codex handoff, QA, and release-note workflows.
