export class GitHubPolicyError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "GitHubPolicyError";
  }
}

const PROTECTED_BRANCH_NAMES = new Set(["main", "master", "production"]);

export function parseCsvList(value: string | undefined, fallback: string[] = []): string[] {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function assertAllowedRepository(repository: string, allowedRepositories: string[]): void {
  if (!allowedRepositories.includes(repository)) {
    throw new GitHubPolicyError(`Repository ${repository} is not allowlisted for Agent Office GitHub writes.`);
  }
}

export function assertSafeBaseBranch(baseBranch: string): void {
  if (baseBranch.trim().length === 0) {
    throw new GitHubPolicyError("Base branch is required.");
  }

  if (baseBranch.includes("..") || baseBranch.startsWith("/") || baseBranch.endsWith("/") || baseBranch.endsWith(".lock")) {
    throw new GitHubPolicyError(`Base branch ${baseBranch} is not a safe branch name.`);
  }
}

export function assertSafeWriteBranch(branchName: string, allowedPrefixes: string[]): void {
  const normalized = branchName.trim();

  if (!normalized) {
    throw new GitHubPolicyError("Write branch is required.");
  }

  if (PROTECTED_BRANCH_NAMES.has(normalized) || normalized.startsWith("release/")) {
    throw new GitHubPolicyError(`Agent Office is not allowed to write to protected branch ${normalized}.`);
  }

  if (normalized.includes("..") || normalized.startsWith("/") || normalized.endsWith("/") || normalized.endsWith(".lock")) {
    throw new GitHubPolicyError(`Branch ${normalized} is not a safe branch name.`);
  }

  if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new GitHubPolicyError(
      `Branch ${normalized} must start with one of the allowed prefixes: ${allowedPrefixes.join(", ")}.`,
    );
  }
}

export function slugifyBranchPart(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);

  return slug || "task";
}
