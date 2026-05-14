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
A clear JSON success/failure result from the CLI.
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

## Configuration

See `.env.example` for required values.

The Notion integration must have permission to read the task page, read page content, append blocks, and update the configured status property.

## Safety Model

The Architect Agent does not receive tools that can mutate external systems. It only returns a structured `ArchitectBrief`. The TypeScript workflow owns side effects and performs Notion writes in a fixed order.

This keeps the v0 path simple while leaving room for later approval gates, additional agent roles, GitHub/Vercel coordination, Claude review, Codex handoff, QA, and release-note workflows.
