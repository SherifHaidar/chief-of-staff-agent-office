# Notion Operating Contract

This document defines the Notion-side operating contract for the Agent Office. It is the practical spec future workflows should follow when reading from, writing to, or explaining the Build Room board.

The contract is intentionally narrow: Notion remains the human-owned operating board, and the Agent Office automates only the approved workflow steps.

## Repository Boundary

There are two separate systems:

- Chief of Staff app / product repo: `SherifHaidar/personal-chief-of-staff`. This is the user-facing product. The Agent Office must not clone, modify, or deploy this repo unless a future workflow explicitly adds a reviewed handoff.
- Agent Office / orchestrator repo: `SherifHaidar/chief-of-staff-agent-office`. This repo owns orchestration, Notion task reading/writeback, agent workflow execution, API endpoints, and local run summaries.

The Agent Office is not product code. It is the controlled office layer around future product work.

## AI Build Tasks Role

`AI Build Tasks` is the main operating board for Agent Office work. It is the shared queue and state machine used by Sherif, Notion, and the Agent Office backend.

The database should hold task intent, priority, agent assignment, acceptance criteria, test guidance, implementation links, review state, and final human decisions. The Agent Office should treat it as the source of truth for workflow state, not as a transient job queue.

## Required Properties

The current Notion board uses these properties. Future workflow code should prefer configurable property names where practical, but these names are the current contract.

| Property | Type | Purpose |
| --- | --- | --- |
| `Task Name` | title | Human-readable task name. |
| `Status` | select | Workflow stage. Current board uses a select property; the service also supports native Notion status properties via config. |
| `Priority` | select | Task priority: `P0`, `P1`, `P2`, or `Later`. |
| `Type` | select | Work type such as feature, bugfix, architecture, research, or release. |
| `System Area` | multi-select | Area affected: Notion, GitHub, Vercel, Supabase, OpenAI, UI, Memory, Tasks, Routing, Voice, Diagnostics. |
| `Assigned Agent` | select | Primary responsible agent or human. |
| `Reviewer` | select | Expected reviewer. |
| `Final Decision` | select | Human decision: approved, rejected, deferred, or partial. |
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

The board status values are the workflow state machine.

| Status | Meaning |
| --- | --- |
| `Draft` | Idea or rough task. Not ready for agent processing. |
| `Ready for Architecture` | Sherif has shaped the task enough for Architect review. This is the only status the v0 scanner should pick up. |
| `Ready for Codex` | Architect Brief has been written back successfully and the task is ready for implementation planning or Codex handoff. |
| `In Codex` | Implementation work is active. |
| `Ready for Claude Review` | Implementation exists and is ready for external/code review. |
| `Ready for Human Test` | Review passed or was addressed, and Sherif should test the product behavior. |
| `Approved` | Sherif approved the result. |
| `Merged` | The relevant PR has been merged. |
| `Deployed` | The change has been deployed. |
| `Parked` | The task is blocked, deferred, or intentionally out of flow. |

Only move a task forward when the preceding step has actually completed. Failed agent runs must not advance status.

## Build Room Dashboard Views

`Build Room - Notion Dashboard` is the Notion-side operating dashboard. It presents linked views over `AI Build Tasks` and should remain the place Sherif scans the pipeline.

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

The current automated write contract is deliberately small:

1. Read tasks from `AI Build Tasks` where `Status = Ready for Architecture`.
2. Fetch the selected task page and relevant task page content.
3. Run the Architect workflow.
4. Append the generated Architect Brief to the same Notion task page.
5. Update `Status` to `Ready for Codex` only after the brief append succeeds.
6. Return and record a structured run summary.

Required safety rules:

- Dry-run mode must not write to Notion.
- Failed runs must not update status.
- Status must not advance if the Architect Brief append fails.
- Agent code should not perform unrelated Notion writes.
- The Architect Agent should generate structured output; the workflow layer owns side effects.

## API Security Contract

The hosted API must not expose Agent Office operations without authorization.

- `GET /health` may remain public, but it must stay generic.
- Every `/agent-office/*` endpoint must require `x-agent-office-api-key`.
- The expected key must come from `AGENT_OFFICE_API_KEY` or an equivalent platform-managed secret.
- Missing or invalid keys must return `401` without running scanner, workflow, or Notion write logic.
- The API key must not be committed to Git or exposed in browser/frontend code.

This is platform-neutral. Deployment protection from a host can be added later, but it should not replace the application-level API key.

## Duplicate-Processing Policy

Duplicate prevention stays lightweight for now.

Primary guard: status transition. After a successful real writeback, the task moves from `Ready for Architecture` to `Ready for Codex`, so scanner-based runs should not pick it up again.

Secondary guard: Architect Brief marker. Before repeated real processing appends another brief, the Agent Office should look for the `Architect Brief:` marker on the task page and skip the task if it already exists.

Future guard: explicit run metadata. Stronger fields such as `Last Architect Brief At` or `Agent Run ID` can make duplicate handling more reliable later, but they are not required for the current contract.

## Manual Responsibilities

These stay manual in Notion for now:

- Create tasks and shape the problem statement.
- Set priority.
- Decide when a task is ready for architecture.
- Clarify acceptance criteria and test steps.
- Maintain `Do Not Change` constraints.
- Park, unpark, or defer tasks.
- Approve architecture-sensitive changes.
- Approve merges, deployments, and final product decisions.

Sherif remains the final approver for important writes, merges, deployments, core architecture changes, and sensitive memory/product behavior.

## Agent Office Responsibilities

The Agent Office should support:

- Scanning `Ready for Architecture` tasks.
- Running the Architect workflow.
- Appending Architect Briefs back to the same task page.
- Moving successfully processed tasks to `Ready for Codex`.
- Producing structured API responses.
- Recording local run summaries for traceability.
- Providing future extension points for Codex implementation handoff, Claude review, GitHub PR coordination, Vercel previews, QA workflows, release notes, and a visual dashboard.

Future integrations should continue to call workflow/application services instead of duplicating Notion write logic in route handlers or agents.

## Optional Future Notion Fields

Do not add these yet. They are useful candidates when the run/audit model needs to become more durable in Notion:

- `Last Agent Run At`
- `Last Agent Run Status`
- `Last Agent Run Error`
- `Last Architect Brief At`
- `Agent Run ID`
- `Branch Name`
- `Blocked Reason`

These fields would help dashboards show recent automation state without requiring a separate run database.

## Run Log Database Recommendation

Do not add a separate Notion Run Log database yet.

The current local JSONL run log plus structured API responses are enough for v1 traceability because the system has one main automated workflow and one main task board. A separate Notion Run Log database becomes worthwhile when at least one of these is true:

- Multiple workflow types run regularly, such as Architect, Codex, Claude review, QA, and release notes.
- Sherif needs cross-task reporting inside Notion.
- Runs need durable history across machines or deployments.
- Run records need to be linked, filtered, or audited independently from task pages.

Until then, keep run summaries local/API-visible and keep Notion focused on the task board. On hosted platforms, do not treat the local JSONL file as durable audit storage unless the platform provides persistent storage mounted at `RUN_LOG_PATH`.
