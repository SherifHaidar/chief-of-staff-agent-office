# GitHub Draft PR Prep v0

GitHub Draft PR Prep is the Agent Office's first controlled write lane into the Chief of Staff product repo.

It proves that the Agent Office can create a branch, commit a useful handoff file, open a draft PR, and link the result back to Notion without editing product code, merging, deploying, or changing repository settings.

## Target Repository

```text
SherifHaidar/personal-chief-of-staff
```

The target repository must be allowlisted with `GITHUB_ALLOWED_REPOS`.

## Flow

```text
Approved Codex Handoff Brief
  -> preview GitHub Draft PR Proposal
  -> sign the exact proposal
  -> human approves the signed proposal
  -> create agent-office/* branch from main
  -> commit .agent-office/handoffs/<notion-task-id>.md
  -> open draft PR against main
  -> append PR link, branch, commit, and file path to the Notion task
```

## GitHub App Permissions

Required GitHub App repository permissions for this v0:

- Metadata: read
- Contents: read/write
- Pull requests: read/write

Do not grant Administration, Actions write, Secrets, Deployments, or Pages permissions for this v0.

## Guardrails

The GitHub write path enforces:

- repository allowlist
- configured base branch, usually `main`
- no writes to `main`, `master`, `production`, or `release/*`
- write branches must start with an allowed prefix such as `agent-office/` or `codex/`
- execution requires `x-agent-office-api-key`
- execution requires a signed, unexpired GitHub Draft PR approval token
- the branch, file content, commit message, PR title, and PR body must match the exact previewed proposal
- duplicate branch/PR checks run before write execution

GitHub branch protection on `main` should remain the platform backstop.

## Handoff File

The committed file lives at:

```text
.agent-office/handoffs/<notion-task-id>.md
```

It includes:

- approved Codex Handoff Brief
- Notion task ID and link
- target repository
- branch name
- problem summary
- product intent
- implementation scope
- likely affected files/modules
- constraints and do-not-change guidance
- implementation steps
- tests to run
- acceptance checklist
- suggested PR title/body
- explicit merge/deploy approval warnings

## Human-Only Actions

The Agent Office must not:

- push to `main`
- merge PRs
- deploy production
- edit repository settings
- edit secrets or environment variables
- force-push
- delete branches
- mark work as final-approved

Sherif remains the approver for merge and deployment.
