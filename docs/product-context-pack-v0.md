# Product Context Pack v0

Product Context Pack is the Agent Office's shared read-only context layer for the Chief of Staff product.

It exists so agents stop producing generic briefs. Before generating architecture or implementation outputs, the Agent Office gathers bounded product and repo context, passes it into the agent, and reports any context gaps.

## Supported Consumers

The capability is shared. It is not owned by one desk.

Current consumers:

- Architect Brief generation
- Codex Handoff Brief generation

Future consumers:

- code-change proposals
- Claude Review
- QA / Release checks
- Build Room dashboard context display

## Sources

Notion:

- `PRODUCT_CONTEXT_PAGE_ID`
- currently `Agent Context - Chief of Staff Product`
- includes product purpose, live capabilities, key files, fragile areas, do-not-break flows, priorities, and testing checklist

GitHub:

- `TARGET_PRODUCT_REPO`
- currently `SherifHaidar/personal-chief-of-staff`
- accessed through the existing GitHub App
- no second GitHub token or parallel access model

AI Build Task:

- task title
- task body
- task status and URL

## GitHub Context Rules

The context pack does not load the whole repo.

It reads:

- repository base branch metadata
- recursive tree metadata only
- a capped set of file blobs
- default files such as `README.md`, `package.json`, and `.env.example`
- product files explicitly mentioned in the Notion context or task
- a small number of keyword-relevant files from the repo tree

Default caps:

- `PRODUCT_CONTEXT_MAX_FILES=10`
- `PRODUCT_CONTEXT_MAX_FILE_CHARS=8000`
- `PRODUCT_CONTEXT_MAX_NOTION_CHARS=16000`
- `PRODUCT_CONTEXT_MAX_TOTAL_CHARS=32000`

When the cap is reached, the pack records a context gap. Codex should inspect additional files during implementation instead of assuming the pack is exhaustive.

## Agent Contract

Agents must:

- use inspected product and repo context when available
- reference real likely files instead of generic modules
- respect do-not-break flows and fragile areas from product context
- surface context gaps in risks, constraints, open questions, or checklists
- avoid pretending that uninspected files were read

Agents still do not receive write tools. The Product Context Pack is read-only input.

## Operator Console

`/office` previews now show whether product context was included.

The preview summary reports:

- whether the pack was included
- whether Notion context was included
- how many repo files were included
- base commit when available
- context gaps

## Configuration

Required:

```text
PRODUCT_CONTEXT_PAGE_ID=361b258f9a3e819f8cd9f9e33d768e0a
TARGET_PRODUCT_REPO=SherifHaidar/personal-chief-of-staff
```

Also required for repo context:

```text
GITHUB_APP_ID=
GITHUB_APP_INSTALLATION_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_ALLOWED_REPOS=SherifHaidar/personal-chief-of-staff
```

The Notion integration must have read access to the product context page.

## Non-Goals

This v0 does not add:

- embeddings
- vector search
- persistent context cache
- full repo indexing
- autonomous code changes
- Claude Review
- QA automation
- Build Room dashboard UI

Those can build on this shared context capability later.
