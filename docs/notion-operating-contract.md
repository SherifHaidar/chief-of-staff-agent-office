# Notion Operating Contract

This document defines the Notion-side operating contract for the Agent Office. Notion remains the human-owned operating board; the Agent Office automates only approved workflow steps.

## Repository Boundary

There are two separate systems:

- Chief of Staff app / product repo: the user-facing product repository configured with `TARGET_PRODUCT_REPO`, currently `SherifHaidar/personal-chief-of-staff`. The Agent Office may create approved Agent Office branches, draft PR prep artifacts, and separately approved implementation draft PRs in this repo, but must not merge, deploy, push to `main`, edit product code without a signed implementation proposal approval, or change settings/secrets.
- Agent Office / orchestrator repo: `SherifHaidar/chief-of-staff-agent-office`. This repo owns orchestration, Notion task reading/writeback, agent workflow execution, API endpoints, approval tokens, GitHub App integration, and run summaries.

The Agent Office is not product code. It is the controlled office layer around product work.

## AI Build Tasks Role

`AI Build Tasks` is the main operating board for Agent Office work. It is the shared queue and state machine used by Sherif, Notion, and the Agent Office backend.

The database should hold task intent, priority, agent assignment, acceptance criteria, test guidance, implementation links, review state, and final human decisions. The Agent Office should treat it as the source of truth for workflow state, not as a hidden job queue.

## Required Properties

| Property | Type | Purpose |
| --- | --- | --- |
| `Task Name` | title | Human-readable task name. |
| `Status` | select | Workflow stage. The service also supports native Notion status properties via config. |
| `Priority` | select | Task priority, if available. |
| `Type` | select | Work type such as feature, bugfix, architecture, research, or release. |
| `System Area` | multi-select | Area affected. |
| `Assigned Agent` | select | Primary responsible agent or human. |
| `Reviewer` | select | Expected reviewer. |
| `Final Decision` | select | Human decision. |
| `Goal` | text | What the task is trying to achieve. |
| `Current Behaviour` | text | What happens now. |
| `Expected Behaviour` | text | Desired behavior. |
| `Acceptance Criteria` | text | Conditions for done. |
| `Test Steps` | text | Manual or automated verification guidance. |
| `Do Not Change` | text | Protected surfaces and explicit constraints. |
| `PR Link` | URL | GitHub PR link when implementation exists. |
| `Vercel Preview` | URL | Preview deployment link when available. |
| `Created Date` | created time | Notion-managed creation timestamp. |
| `Last Edited` | last edited time | Notion-managed update timestamp. |

## Status Values

| Status | Meaning |
| --- | --- |
| `Draft` | Idea or rough task. Not ready for agent processing. |
| `Ready for Architecture` | Sherif has shaped the task enough for Architect review. |
| `Ready for Codex` | Architect Brief has been written back successfully and the task is ready for Implementation Desk handoff. |
| `In Codex` | Implementation work is active or ready to be handed to Codex/GitHub tooling. GitHub Draft PR Prep may occur here. |
| `Ready for Claude Review` | Implementation exists and is ready for external/code review. |
| `Ready for Human Test` | Review passed or was addressed, and Sherif should test behavior. |
| `Approved` | Sherif approved the result. |
| `Merged` | The relevant PR has been merged. |
| `Deployed` | The change has been deployed. |
| `Parked` | The task is blocked, deferred, or intentionally out of flow. |

Only move a task forward when the preceding step has actually completed. Failed agent runs must not advance status.

## Build Room Dashboard Views

`Build Room - Notion Dashboard` is the Notion-side operating dashboard. It should remain the place Sherif scans the pipeline.

Current views:

| View | Intended filter |
| --- | --- |
| `All Active Tasks` | All tasks except `Deployed` and `Parked`. |
| `Ready for Architecture` | `Status = Ready for Architecture`. |
| `Ready for Codex` | `Status = Ready for Codex`. |
| `In Codex` | `Status = In Codex`. |
| `Ready for Claude Review` | `Status = Ready for Claude Review`. |
| `Ready for Human Test` | `Status = Ready for Human Test`. |
| `Approved / Merged / Deployed` | `Status` is one of `Approved`, `Merged`, or `Deployed`. |
| `Parked / Blocked` | `Status = Parked`. |

The dashboard should stay human-readable and operational. It should not become the hidden execution engine.

## Agent Office Write Contract

### Architecture Desk

1. Read tasks where `Status = Ready for Architecture`.
2. Fetch the selected task page and relevant task content.
3. Generate an Architect Brief preview.
4. Optionally revise the preview using Sherif feedback, the previous signed preview, task content, and Product Context Pack.
5. On approval, append the exact latest approved Architect Brief to the same task page.
6. Include approval timestamp, revision number, Architecture disposition, owner decision notes, and context gaps in the writeback.
7. Update `Status` to `Ready for Codex` only after the append succeeds.
8. Return and record a structured run summary.

### Implementation Desk

1. Read tasks where `Status = Ready for Codex`.
2. Fetch the selected task page and relevant task content.
3. Generate a Codex Handoff Brief preview.
4. On approval, append the exact approved Codex Handoff Brief to the same task page.
5. Update `Status` to `In Codex` only after the append succeeds, when `NOTION_STATUS_AFTER_CODEX_HANDOFF` is configured.
6. Return and record a structured run summary.

### GitHub Draft PR Prep

1. Require an approved Codex Handoff Brief marker on the task page.
2. Generate a GitHub Draft PR Proposal from the exact approved handoff token.
3. On approval, create an allowlisted `agent-office/*` or `codex/*` branch in the product repo.
4. Commit `.agent-office/handoffs/<notion-task-id>.md` to that branch.
5. Open a draft PR against the configured base branch, usually `main`.
6. Append `GitHub Draft PR:` blocks to the same Notion task page with PR URL, branch, base commit, commit SHA, and handoff file path.
7. Do not update task status automatically after draft PR prep.

### Controlled Implementation

1. Read implementation-ready tasks where `Status = In Codex`.
2. Require an approved Codex Handoff Brief marker on the task page.
3. Load the persisted Codex Handoff Brief from the Notion writeback as a v0 resume/recovery path.
4. Generate a Controlled Implementation Proposal from the task, approved handoff content, Product Context Pack, and task page content.
5. Preview exact proposed file paths, replacement contents, PR text, and task-specific verification plan.
6. Require separate signed implementation approval before writing product code.
7. On approval, create or update an allowlisted implementation branch and draft PR.
8. Commit only the exact approved file changes.
9. Capture available GitHub check/status evidence.
10. Append `Controlled Implementation Draft PR:` blocks to the same Notion task page with PR URL, branch, commit SHA, files changed, verification plan, evidence, and gaps.
11. Do not update task status automatically after implementation PR creation in v0.

Required safety rules:

- Preview/dry-run mode must not write to Notion or GitHub.
- Approval must write or execute the exact signed preview payload and must not rerun or regenerate it.
- Failed runs must not update status.
- Status must not advance if append fails.
- GitHub writes must be repo-allowlisted and branch-prefix guarded.
- The Agent Office must not push to `main`, merge, deploy, change settings, or change secrets.
- Product code writes require their own implementation approval token. Architect Brief and Codex Handoff approvals are not coding approvals.
- Workflow/application code owns side effects.

## API Security Contract

- `GET /health` may remain public, but it must stay generic.
- `GET /office` may remain public as a shell, but it must not embed secrets or task data.
- Every `/agent-office/*` endpoint must require `x-agent-office-api-key`.
- Missing or invalid keys must return `401` without running scanner, workflow, Notion, or GitHub write logic.
- Approval endpoints must also require a valid signed approval token.

## Duplicate-Processing Policy

Primary guard: status transition. Successful Architecture writeback moves `Ready for Architecture` to `Ready for Codex`. Successful Implementation Desk writeback moves `Ready for Codex` to `In Codex`.

Secondary guard: page markers. Before approved writeback, the Agent Office checks for:

- `Architect Brief:`
- `Codex Handoff Brief:`

GitHub Draft PR Prep also checks for duplicate branch/PR before creating a new branch. Controlled Implementation creates or updates the scoped implementation branch/PR instead of creating duplicates.

Future guard: explicit run metadata. Stronger fields such as `Last Architect Brief At`, `Last Agent Run At`, or `Agent Run ID` can make duplicate handling more reliable later.

## Manual Responsibilities

These stay manual in Notion/GitHub for now:

- Create tasks and shape the problem statement.
- Set priority.
- Decide when a task is ready for Architecture or Codex handoff.
- Clarify acceptance criteria and test steps.
- Maintain `Do Not Change` constraints.
- Park, unpark, or defer tasks.
- Approve architecture-sensitive changes.
- Review draft PRs.
- Approve merges, deployments, and final product decisions.

Sherif remains the final approver for important writes, merges, deployments, core architecture changes, and sensitive product behavior.

## Agent Office Responsibilities

The Agent Office currently supports:

- Scanning `Ready for Architecture` tasks.
- Reading the Chief of Staff product context page into a bounded Product Context Pack.
- Running the Architect workflow.
- Appending approved Architect Briefs back to the same task page.
- Moving successfully processed tasks to `Ready for Codex`.
- Scanning `Ready for Codex` tasks.
- Running the Implementation Desk / Codex Handoff workflow.
- Appending approved Codex Handoff Briefs back to the same task page.
- Moving successfully processed handoffs to `In Codex`.
- Scanning implementation-ready `In Codex` tasks that already contain an approved Codex Handoff Brief marker.
- Resuming Controlled Implementation previews from the persisted Notion Codex Handoff Brief.
- Creating approved GitHub Draft PR Prep branches and draft PRs with handoff files.
- Creating separately approved implementation branches and draft PRs with exact approved product file changes.
- Capturing task-specific verification plans and available GitHub check evidence for implementation PRs.
- Producing structured API responses and local run summaries.

Future integrations should continue to call workflow/application services instead of duplicating Notion or GitHub write logic in route handlers or agents.

## Optional Future Notion Fields

Do not add these yet:

- `Last Agent Run At`
- `Last Agent Run Status`
- `Last Agent Run Error`
- `Last Architect Brief At`
- `Last Architect Brief Hash`
- `Last Codex Handoff At`
- `Last Codex Handoff Hash`
- `Agent Run ID`
- `Branch Name`
- `Blocked Reason`

## Run Log Database Recommendation

Do not add a separate Notion Run Log database yet.

The current JSONL run log plus structured API responses are enough for early traceability. A separate Notion Run Log database becomes worthwhile when multiple workflow types run regularly, Sherif needs cross-task reporting inside Notion, or run records need durable audit history across deployments.
