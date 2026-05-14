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

### List Ready Architecture Tasks

Returns Notion AI Build Tasks where the configured Status property equals `Ready for Architecture`.

```bash
curl http://127.0.0.1:3000/agent-office/tasks/ready-for-architecture
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
  -d '{"dryRun":true}'
```

Real writeback for every task currently marked `Ready for Architecture`:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/run-ready-architecture \
  -H "Content-Type: application/json" \
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
  -d '{"taskId":"<notion-page-id>","dryRun":false}'
```

A successful real writeback appends the Architect Brief to the same Notion page and updates the configured status property after the append succeeds.

## Run Log

The API records one JSON object per Architect workflow run to the configured JSONL file. By default:

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

The run log is intentionally local and append-only for now. It is not committed to Git and is not a Notion database.

## Configuration

See `.env.example` for required values. For the default v0 workflow:

- `NOTION_TASK_DATABASE_ID` should be the AI Build Tasks database ID.
- `NOTION_STATUS_PROPERTY_TYPE` should match the Notion property type for the configured status property. The current AI Build Tasks board uses `select`; use `status` only if the Notion property is converted to a native Notion status property.
- `NOTION_READY_FOR_ARCHITECTURE_STATUS` should match the exact Notion status option used for tasks awaiting architecture review, usually `Ready for Architecture`.
- `NOTION_STATUS_AFTER_ARCHITECT` should match the exact Notion status option you want after writeback, usually `Ready for Codex`.
- `RUN_LOG_PATH` should point to the local JSONL audit file, usually `data/run-log.jsonl`.

The Notion integration must have permission to read the task database, read task page content, append blocks, and update the configured status property.

## Safety Model

The Architect Agent does not receive tools that can mutate external systems. It only returns a structured `ArchitectBrief`. The TypeScript workflow owns side effects and performs Notion writes in a fixed order.

The HTTP API is intentionally thin: it validates requests, calls the existing workflow layer, records run summaries, and returns JSON. It does not duplicate Notion write logic.

The Ready for Architecture scanner only queries Notion and returns task metadata. Batch-running ready tasks still delegates each task to the existing Architect workflow.

This keeps the v0 path simple while leaving room for later approval gates, additional agent roles, GitHub/Vercel coordination, Claude review, Codex handoff, QA, and release-note workflows.
