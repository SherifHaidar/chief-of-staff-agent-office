# chief-of-staff-agent-office

Standalone AI Development Office Orchestrator for the personal Chief of Staff product.

This repository owns orchestration only. It coordinates controlled office workflows around Notion tasks, previews proposed agent/GitHub actions, and executes only after explicit approval.

## Current Workflows

```text
Ready for Architecture task
  -> Architect Agent preview
  -> optional revision feedback loop
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

```text
Approved Codex Handoff Brief
  -> GitHub Draft PR Proposal preview
  -> signed approval
  -> create agent-office/* branch in product repo
  -> commit .agent-office/handoffs/<notion-task-id>.md
  -> open draft PR against main
  -> append PR link/branch/commit back to Notion
```

```text
Approved Codex Handoff Brief
  -> Controlled Implementation Proposal preview
  -> separate signed implementation approval
  -> create/update agent-office/* implementation branch
  -> commit exact approved file changes
  -> open/update draft PR against main
  -> capture available GitHub checks/evidence
  -> append PR/check/evidence summary back to Notion
```

The longer-term goal is an AI Development Office that can coordinate architecture, implementation planning, review, QA, release notes, GitHub/Vercel coordination, and human approval gates.

## Product Context Pack v0

Before generating Architect Briefs or Codex Handoff Briefs, the Agent Office can build a bounded Product Context Pack for the Chief of Staff app. This is a shared capability for current and future desks: Architect, Implementation Desk, future code-change proposals, Claude Review, QA/Release checks, and Build Room dashboard context display.

The pack combines:

- the Notion product context page configured by `PRODUCT_CONTEXT_PAGE_ID`
- the AI Build Task page content
- a bounded GitHub repo snapshot from `TARGET_PRODUCT_REPO`
- default product repo files such as `README.md`, `package.json`, `.env.example`, and product files named in the Notion context/task
- context gaps when files or sources are missing

It does not load the whole repo. File count and character budgets are capped. Agents are instructed to use the inspected context and call out gaps instead of guessing.

## Docs

- [Notion Operating Contract](docs/notion-operating-contract.md)
- [Operator Console v0](docs/operator-console-v0.md)
- [Architecture Desk Revision Loop v0](docs/architecture-desk-revision-loop-v0.md)
- [Implementation Desk v0](docs/implementation-desk-v0.md)
- [GitHub Draft PR Prep v0](docs/github-draft-pr-prep-v0.md)
- [Controlled Implementation + Verification Lane v0](docs/controlled-implementation-verification-v0.md)
- [Product Context Pack v0](docs/product-context-pack-v0.md)

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
- Architecture Desk revisions: provide feedback, generate revised previews, and approve only the latest satisfactory preview.
- Implementation Desk: list `Ready for Codex` tasks, preview Codex Handoff Briefs, approve exact writeback, then preview/approve GitHub Draft PR Prep or Controlled Implementation.
- Codex Dispatch: preview a short `@codex` PR comment for an existing work-order PR/task, post it only after explicit confirmation, record the comment URL/status to Notion, and refresh GitHub evidence for Codex responses or applied commits.
- Post-Merge Closeout: preview merged-PR evidence and planned Notion writes, then commit the closeout only after an explicit click.

Approval tokens expire after 120 minutes. Each revised Architect Brief preview creates a new signed token and replaces the active token in the console. Approval endpoints write or execute the exact previewed payload embedded in the submitted signed token and do not rerun the model or regenerate GitHub proposal content. Approving an Architect Brief or Codex Handoff never starts coding; Controlled Implementation requires its own exact proposal approval. Codex Dispatch posts only the previewed `@codex` PR comment and records evidence; it does not merge, deploy, or bypass Review + Iteration Desk.

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

Revise an Architect Brief preview:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/architect-review/revise \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"taskId":"<notion-page-id>","previousApprovalToken":"<approval-token-from-preview>","revisionFeedback":"Tighten scope and clarify remaining owner decisions."}'
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

Preview GitHub Draft PR Prep from the approved Codex Handoff token:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/github/draft-pr \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"codexHandoffApprovalToken":"<codex-handoff-approval-token>"}'
```

Approve exact GitHub Draft PR creation:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/github/draft-pr/approve \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"approvalToken":"<github-draft-pr-approval-token>"}'
```

Preview a Controlled Implementation Proposal from the approved Codex Handoff token:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/github/implementation \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"codexHandoffApprovalToken":"<codex-handoff-approval-token>"}'
```

Approve exact implementation branch and draft PR creation:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/github/implementation/approve \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"approvalToken":"<implementation-approval-token>"}'
```

Run Review + Iteration Desk v0 for an implementation PR:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/review-desk \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"repository":"SherifHaidar/personal-chief-of-staff","pullRequestNumber":6,"taskId":"<notion-task-id>"}'
```

Preview the Codex Dispatch v0 `@codex` comment for an open implementation work-order PR:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/codex-dispatch/preview \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"repository":"SherifHaidar/chief-of-staff-agent-office","pullRequestNumber":22,"taskId":"<notion-task-id>"}'
```

Post the previewed `@codex` comment and record the comment URL/status to the selected Notion task:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/codex-dispatch/record \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"approvalToken":"<codex-dispatch-approval-token>"}'
```

Refresh Codex Dispatch status from GitHub comments, reviews, review-thread comments, and PR commits after the posted `@codex` comment:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/codex-dispatch/status \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"repository":"SherifHaidar/chief-of-staff-agent-office","pullRequestNumber":22,"taskId":"<notion-task-id>","dispatchCommentCreatedAt":"<posted-comment-created-at>","dispatchCommentId":123}'
```

Preview Post-Merge Closeout v0 for an already-merged PR:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/post-merge-closeout/preview \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"repository":"SherifHaidar/chief-of-staff-agent-office","pullRequestNumber":20,"taskId":"<notion-task-id>"}'
```

Commit the previewed Post-Merge Closeout to the Notion task after checking the preview:

```bash
curl -X POST http://127.0.0.1:3000/agent-office/post-merge-closeout/commit \
  -H "Content-Type: application/json" \
  -H "x-agent-office-api-key: $AGENT_OFFICE_API_KEY" \
  -d '{"repository":"SherifHaidar/chief-of-staff-agent-office","pullRequestNumber":20,"taskId":"<notion-task-id>"}'
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

Required for GitHub Draft PR Prep and Controlled Implementation:

- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_ALLOWED_REPOS=SherifHaidar/personal-chief-of-staff,SherifHaidar/chief-of-staff-agent-office`
- `GITHUB_ALLOWED_BRANCH_PREFIXES=agent-office/,codex/`
- `GITHUB_DEFAULT_BASE_BRANCH=main`
- `IMPLEMENTATION_MAX_CHANGED_FILES=4`
- `IMPLEMENTATION_MAX_FILE_CHARS=16000`
- `IMPLEMENTATION_MAX_TOTAL_CHANGE_CHARS=32000`

Required for Review + Iteration Desk v0:

- `ANTHROPIC_API_KEY`
- `CLAUDE_REVIEW_MODEL=claude-sonnet-4-6`
- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_ALLOWED_REPOS` must include every repo being reviewed, for example `SherifHaidar/personal-chief-of-staff,SherifHaidar/chief-of-staff-agent-office`
- `REVIEW_DESK_MAX_CHANGED_FILES=30`
- `REVIEW_DESK_MAX_PATCH_CHARS=8000`

Required for Post-Merge Closeout v0:

- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_ALLOWED_REPOS` must include every repo being closed out
- `NOTION_STATUS_AFTER_POST_MERGE_CLOSEOUT=Merged`

Required for Codex Dispatch v0:

- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_ALLOWED_REPOS` must include every repo whose work-order PR `@codex` comments can be previewed, posted, recorded, or checked

Required for Product Context Pack:

- `PRODUCT_CONTEXT_PAGE_ID=361b258f9a3e819f8cd9f9e33d768e0a`
- existing Notion integration access to that page
- existing GitHub App access to `TARGET_PRODUCT_REPO` for repo context

Recommended explicit configuration:

- `OPENAI_MODEL=gpt-5.4`
- `NOTION_STATUS_PROPERTY=Status`
- `NOTION_STATUS_PROPERTY_TYPE=select`
- `NOTION_READY_FOR_ARCHITECTURE_STATUS=Ready for Architecture`
- `NOTION_READY_FOR_CODEX_STATUS=Ready for Codex`
- `NOTION_STATUS_AFTER_ARCHITECT=Ready for Codex`
- `NOTION_STATUS_AFTER_CODEX_HANDOFF=In Codex`
- `NOTION_STATUS_AFTER_POST_MERGE_CLOSEOUT=Merged`
- `TARGET_PRODUCT_REPO=SherifHaidar/personal-chief-of-staff`
- `PRODUCT_CONTEXT_MAX_FILES=10`
- `PRODUCT_CONTEXT_MAX_FILE_CHARS=8000`
- `PRODUCT_CONTEXT_MAX_NOTION_CHARS=16000`
- `PRODUCT_CONTEXT_MAX_TOTAL_CHARS=32000`
- `RUN_LOG_PATH=data/run-log.jsonl`

Use long random values for `AGENT_OFFICE_API_KEY` and `AGENT_OFFICE_APPROVAL_SECRET`. The approval secret signs short-lived approval tokens and should be different from the API key.

The GitHub App should be installed only on repos Agent Office needs to prepare or review, currently `SherifHaidar/personal-chief-of-staff` and `SherifHaidar/chief-of-staff-agent-office`, and should have `Metadata: read`, `Contents: read/write`, `Pull requests: read/write`, PR conversation comment access through `Pull requests: write` or `Issues: write`, and check/status/deployment read access if available. Product Context Pack and Review Desk use the same GitHub App access model; do not add a second GitHub token. Do not grant Administration, Actions write, secrets, or settings permissions.

The Notion integration must be able to read the AI Build Tasks database, read task page content, read the product context page, append blocks to task pages, and update the configured status property.

## Vercel

The repo includes explicit Vercel function entrypoints under `api/` and rewrites in `vercel.json`. Deployed public routes match local routes:

```text
/health
/office
/agent-office/*
```

On Vercel, the adapter defaults `RUN_LOG_PATH` to `/tmp/agent-office-run-log.jsonl` when the variable is not set. Treat `/tmp` and hosted JSONL logs as ephemeral; use structured API responses and Vercel function logs until a durable run store exists.

## Safety Model

Agents do not receive tools that mutate external systems. They only return structured outputs. The TypeScript workflow layer owns side effects and performs Notion/GitHub writes in a fixed order.

Agents may receive a bounded Product Context Pack containing Notion product context and selected GitHub repo file excerpts. This is read-only context, not tool access. Missing context is surfaced as context gaps.

Dry-run and preview steps do not write to Notion or GitHub. Approved Notion writeback appends to the same task page first and updates status only after append succeeds. Approved GitHub Draft PR Prep creates only an allowlisted branch, one handoff file commit, and a draft PR. Approved Controlled Implementation can commit exact approved product file changes to an allowlisted implementation branch and open/update a draft PR. It does not push to main, merge, deploy, or change repository settings/secrets.
