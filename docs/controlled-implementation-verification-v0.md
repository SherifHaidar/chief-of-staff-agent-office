# Controlled Implementation + Verification Lane v0

This lane is the first Agent Office path that can move real product code in the target repository.

It is intentionally not a direct Codex runner. The deployed Agent Office does not execute an autonomous coding loop or run local tests inside the product repo. Instead, it generates an exact implementation proposal, asks Sherif to approve that exact proposal, then uses the GitHub App to create or update a scoped implementation branch and draft PR.

## Flow

1. A Notion task has an approved Codex Handoff Brief written back to the task page.
2. The Operator Console previews a Controlled Implementation Proposal.
3. The proposal includes exact file paths and complete replacement file contents.
4. Sherif reviews the proposed files and task-specific verification plan.
5. A separate implementation approval token is created for the exact proposal.
6. Approval creates or updates an `agent-office/*` or `codex/*` branch.
7. The Agent Office commits the exact approved file changes.
8. The Agent Office opens or updates a draft PR against `main`.
9. The Agent Office captures available GitHub check/status evidence.
10. The Agent Office appends the branch, PR, commit, changed files, verification plan, and evidence summary back to the same Notion task.

## Approval Boundary

Approving an Architect Brief or Codex Handoff Brief does not approve coding.

Coding requires a separate Controlled Implementation Proposal approval. The approval token embeds the exact implementation proposal and hashes it. If the file paths, file contents, branch, PR body, verification plan, or other proposal fields change, the old token no longer approves the new proposal.

## GitHub Guardrails

The lane may:

- read the allowlisted product repository;
- create or update a branch with an allowed prefix;
- commit the exact approved file changes;
- open or update a draft PR;
- read GitHub check/status evidence for the implementation commit.

The lane must not:

- push to `main`, `master`, `production`, or release branches;
- merge PRs;
- deploy production;
- edit repository settings, secrets, GitHub workflow files, Vercel config, lockfiles, `.env` files, or private keys;
- create non-draft PRs;
- treat any check result as merge approval.

## Proposal Limits

v0 is for small, reviewable product changes.

Defaults:

- `IMPLEMENTATION_MAX_CHANGED_FILES=4`
- `IMPLEMENTATION_MAX_FILE_CHARS=16000`
- `IMPLEMENTATION_MAX_TOTAL_CHANGE_CHARS=32000`

These limits keep approval tokens and browser requests manageable and reduce the chance of broad accidental changes.

## Verification Plan

The verification plan must be task-specific. It is generated from:

- the Notion task page, including approved Architect Brief and Codex Handoff content;
- the approved Codex Handoff payload;
- the Product Context Pack;
- the exact proposed file changes;
- the product constraints and do-not-break guidance available in context.

It includes:

- automated checks to rely on;
- manual checks Sherif should perform;
- acceptance criteria;
- regression risks;
- evidence to collect.

The execution result captures GitHub checks/statuses available immediately after PR creation. Checks may still be pending; pending or unavailable checks are written as verification gaps, not as success.

## Notion Writeback

The Notion task receives:

- draft PR link;
- repository, branch, base branch, and base commit;
- implementation commit SHA;
- files changed;
- implementation summary;
- verification plan;
- captured evidence;
- context gaps;
- explicit draft-only approval warning.

Status updates are intentionally not part of v0. The existing Notion status board remains the operating source of truth, and Sherif remains final approver for merge and deployment.
