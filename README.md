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

## v0 Scope

Input:

```text
Notion task page ID
```

Action:

1. Fetch the Notion task page and its body content.
2. Run a single Architect Agent with structured output.
3. Render the Architect Brief into Notion blocks.
4. Append the brief to the same page.
5. Update the task status after successful writeback.

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
  "briefGenerated": true
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

## Configuration

See `.env.example` for required values. For the default v0 workflow, `NOTION_STATUS_AFTER_ARCHITECT` should match the exact Notion status option you want after writeback, usually `Ready for Codex`.

The Notion integration must have permission to read the task page, read page content, append blocks, and update the configured status property.

## Safety Model

The Architect Agent does not receive tools that can mutate external systems. It only returns a structured `ArchitectBrief`. The TypeScript workflow owns side effects and performs Notion writes in a fixed order.

The HTTP API is intentionally thin: it validates requests, calls the existing workflow layer, and returns JSON. It does not duplicate Notion write logic.

This keeps the v0 path simple while leaving room for later approval gates, additional agent roles, GitHub/Vercel coordination, Claude review, Codex handoff, QA, and release-note workflows.
