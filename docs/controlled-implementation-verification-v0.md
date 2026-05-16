# Controlled Implementation + Verification Lane v0

This lane creates the starting point for product implementation. It does not generate product-code diffs from partial context.

The deployed Agent Office acts as the controller:

- load the `In Codex` Notion task;
- load the approved persisted `Codex Handoff Brief:`;
- preview a deterministic implementation work order;
- require Sherif approval for that exact work-order proposal;
- create or update a product repo branch and draft PR;
- commit `.agent-office/work-orders/<notion-task-id>.md`;
- append the PR, branch, commit, and work-order path back to Notion.

The resulting draft PR is explicitly marked:

> Implementation pending — this is the starting point for Codex implementation, not the final deliverable.

Codex implementation happens after this step, on the real product repo branch/checkout, where Codex can inspect files, edit normally, run tests, and push implementation commits.

## Flow

1. A Notion task is `In Codex` and has an approved Codex Handoff Brief written back to the task page.
2. The Operator Console lists it as Implementation Ready.
3. The Operator Console loads the persisted Codex Handoff Brief from Notion as a v0 resume/recovery path.
4. The Operator Console previews a deterministic implementation work-order proposal.
5. The proposal includes repository, branch, base SHA, PR title/body, work-order path/content, task ID, and handoff summary.
6. Sherif reviews the exact work order and draft PR text.
7. A separate implementation approval token is created for the exact work-order proposal.
8. Approval creates or updates an `agent-office/*` or `codex/*` branch.
9. The Agent Office commits only `.agent-office/work-orders/<notion-task-id>.md`.
10. The Agent Office opens or updates a draft PR against `main`.
11. The Agent Office captures available GitHub check/status evidence for the work-order commit.
12. The Agent Office appends the branch, PR, commit, work-order path, and next action back to the same Notion task.

## Approval Boundary

Approving an Architect Brief or Codex Handoff Brief does not approve coding.

Approving the implementation work order does not mean product implementation is complete. It approves only the branch, draft PR, PR body, and work-order file that Codex will use as the starting point.

The approval token embeds and hashes the exact work-order proposal. If repository, branch, base SHA, PR title/body, work-order path/content, task ID, or handoff summary changes, the old token no longer approves the new proposal.

For v0, already-approved `In Codex` tasks can be resumed by parsing the persisted `Codex Handoff Brief:` Notion writeback. This is a recovery path for the current Office workflow, not the long-term durable proposal store.

## GitHub Guardrails

The lane may:

- read the allowlisted product repository base branch SHA;
- create or update a branch with an allowed prefix;
- commit the exact approved work-order file;
- open or update a draft PR;
- read GitHub check/status evidence for the work-order commit.

The lane must not:

- generate product-code file replacements;
- edit product application files;
- push to `main`, `master`, `production`, or release branches;
- merge PRs;
- deploy production;
- edit repository settings, secrets, GitHub workflow files, Vercel config, lockfiles, `.env` files, or private keys;
- create non-draft PRs;
- treat the work-order PR as final implementation.

## Verification

The work-order PR is not the verification artifact for the product change. It is the handoff point for the next Codex implementation pass.

After the work-order PR exists, Codex should:

- check out the created branch;
- inspect the product repo directly;
- implement the product change in normal product files;
- run the relevant checks from the handoff and task;
- push implementation commits to the same PR;
- report evidence and remaining risks for review.

## Notion Writeback

The Notion task receives:

- draft PR link;
- repository, branch, base branch, and base commit;
- work-order commit SHA;
- work-order file path;
- approved handoff summary;
- explicit next action for Codex;
- explicit draft-only and implementation-pending warning.

Status updates are intentionally not part of v0. The existing Notion status board remains the operating source of truth, and Sherif remains final approver for merge and deployment.
