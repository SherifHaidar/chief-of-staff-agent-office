# CODEX_HANDOFF

## Project

`chief-of-staff-agent-office` is the standalone AI Development Office orchestrator for the Personal Chief of Staff product.

## Why It Exists

This repo coordinates controlled architecture, implementation planning, GitHub PR preparation, review, and post-merge closeout workflows around Notion tasks. It exists so product work can move through explicit preview and approval gates rather than letting agents mutate Notion or GitHub directly.

## Current Status

Active personal project. The latest known GitHub `main` state includes the Agent Office workflows through merged PR work for Architecture Desk, Implementation Desk, GitHub Draft PR Prep, Controlled Implementation, Product Context Pack, Review Desk, and Post-Merge Closeout support.

The work computer had downloaded source snapshots rather than a live Git clone. The authoritative source for continuing on the personal desktop is GitHub.

## Main Folders and Files

- `api/`: Vercel/serverless route entrypoints for health, office, and agent-office endpoints.
- `src/server/`: Fastify app, local server, Vercel adapter, and Operator Console page.
- `src/agents/`: Structured-output agents for architecture, handoff, implementation, and review workflows.
- `src/workflows/`: Workflow orchestration around preview, approval, and writeback steps.
- `src/github/`: GitHub App client and services for branch, commit, PR, implementation, and review operations.
- `src/notion/`: Notion client, task repository, renderers, and handoff parsing.
- `src/domain/`: Domain objects and policy rules for tasks, briefs, proposals, and review decisions.
- `tests/`: Vitest tests for routes, workflows, services, policies, rendering, and adapters.
- `docs/`: Operating docs for the Notion contract, console, implementation lane, product context, review, and closeout workflows.
- `.env.example`: Placeholder-only configuration template.

## Important Decisions

- Agents return structured outputs only; TypeScript services own all side effects.
- Dry-run and preview steps do not write to Notion or GitHub.
- Approval tokens sign exact preview payloads and expire.
- Architect Brief approval and Codex Handoff approval do not start coding.
- Controlled Implementation requires a separate exact approval and writes only to allowlisted branch prefixes.
- GitHub writes are limited to allowlisted repos and branches, not `main`.
- The product repo target is `SherifHaidar/personal-chief-of-staff`.
- Product Context Pack is bounded and read-only; it surfaces gaps instead of guessing.

## What Is Working

- Local server and Vercel route structure are represented in code.
- Operator Console supports Architecture Desk, Implementation Desk, GitHub Draft PR Prep, Controlled Implementation, Review Desk, and closeout flows.
- Tests exist across core workflows, approval gates, GitHub services, Notion renderers, and server routes.
- `.gitignore` excludes local env files, logs, run data, build output, coverage, and dependencies.

## Incomplete or Experimental

- Run logs are still file-based/ephemeral unless a durable store is added.
- Product Context Pack is intentionally bounded and may miss files unless configured or named.
- Review and closeout workflows should be validated against real PRs after cloning.
- Deployment/runtime config must be recreated on the personal desktop and in Vercel from secure sources.

## Known Risks and Blockers

- Do not commit real `.env`, private keys, API keys, tokens, JSONL run logs, or local data files.
- `GITHUB_APP_PRIVATE_KEY` must stay out of Git.
- GitHub App permissions should stay narrow: no repo administration, no secrets/settings writes.
- Notion database property names and status values must match configuration.
- The work computer did not have Git installed and did not contain a live clone, so local shell validation was not available there.

## How To Run Locally

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/office
```

## Environment Variables Needed

Use placeholder values only when creating local env files. Required or commonly used names:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`
- `CLAUDE_REVIEW_MODEL`
- `AGENT_OFFICE_API_KEY`
- `AGENT_OFFICE_APPROVAL_SECRET`
- `NOTION_TOKEN`
- `NOTION_TASK_DATABASE_ID`
- `NOTION_STATUS_PROPERTY`
- `NOTION_STATUS_PROPERTY_TYPE`
- `NOTION_READY_FOR_ARCHITECTURE_STATUS`
- `NOTION_READY_FOR_CODEX_STATUS`
- `NOTION_STATUS_AFTER_ARCHITECT`
- `NOTION_STATUS_AFTER_CODEX_HANDOFF`
- `NOTION_STATUS_AFTER_POST_MERGE_CLOSEOUT`
- `TARGET_PRODUCT_REPO`
- `PRODUCT_CONTEXT_PAGE_ID`
- `GITHUB_APP_ID`
- `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_ALLOWED_REPOS`
- `GITHUB_ALLOWED_BRANCH_PREFIXES`
- `GITHUB_DEFAULT_BASE_BRANCH`
- `IMPLEMENTATION_MAX_CHANGED_FILES`
- `IMPLEMENTATION_MAX_FILE_CHARS`
- `IMPLEMENTATION_MAX_TOTAL_CHANGE_CHARS`
- `REVIEW_DESK_MAX_CHANGED_FILES`
- `REVIEW_DESK_MAX_PATCH_CHARS`
- `RUN_LOG_PATH`
- `DRY_RUN`
- `LOG_LEVEL`

## Recent Work Completed

Recent GitHub work includes merged PRs for Product Context Pack, Architecture Desk revision loop, Controlled Implementation, policy fixes, implementation work-order PR creation, and post-merge/review-related Agent Office evolution.

## Immediate Next Actions

1. Clone this repo on the personal desktop.
2. Install dependencies and run `npm run typecheck` and `npm test`.
3. Recreate local `.env` from `.env.example` using secure secret sources.
4. Confirm Vercel env vars match the intended production setup.
5. Open `/office` locally and dry-run a task list/preview flow before approving any write.
6. Continue work from the latest GitHub `main` branch, not from downloaded work-computer snapshots.

## Prompt For Codex On Personal Desktop

```text
Read this repo and help me continue the Chief of Staff Agent Office project. First inspect README.md, CODEX_HANDOFF.md, package.json, docs/, src/server/, src/workflows/, src/github/, src/notion/, and tests/. Then summarize the current architecture, verify how to run it locally, identify any failing tests or setup blockers, and recommend the next implementation step without changing files until I approve.
```
