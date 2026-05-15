import { createSign } from "node:crypto";

export type GitHubAppClientConfig = {
  appId: string;
  installationId: string;
  privateKey: string;
};

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

type InstallationTokenResponse = {
  expires_at: string;
  token: string;
};

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, "\n");
}

function createGitHubAppJwt(config: GitHubAppClientConfig, now = new Date()): string {
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const expiresAt = issuedAt + 9 * 60;
  const encodedHeader = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const encodedPayload = base64UrlJson({ exp: expiresAt, iat: issuedAt, iss: config.appId });
  const valueToSign = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(valueToSign);
  signer.end();
  const signature = signer.sign(normalizePrivateKey(config.privateKey), "base64url");

  return `${valueToSign}.${signature}`;
}

export class GitHubAppClient {
  private installationToken?: { expiresAt: number; token: string };

  constructor(private readonly config: GitHubAppClientConfig) {}

  async request<T>(input: { body?: unknown; method?: string; path: string; query?: Record<string, string> }): Promise<T> {
    const token = await this.getInstallationToken();
    const url = new URL(`https://api.github.com${input.path}`);

    for (const [name, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(name, value);
    }

    const response = await fetch(url, {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "chief-of-staff-agent-office",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: input.method ?? "GET",
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      throw new GitHubApiError(payload.message ?? `GitHub request failed with ${response.status}.`, response.status);
    }

    return payload as T;
  }

  private async getInstallationToken(): Promise<string> {
    const now = Date.now();
    if (this.installationToken && this.installationToken.expiresAt - now > 60_000) {
      return this.installationToken.token;
    }

    const jwt = createGitHubAppJwt(this.config);
    const response = await fetch(
      `https://api.github.com/app/installations/${encodeURIComponent(this.config.installationId)}/access_tokens`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "User-Agent": "chief-of-staff-agent-office",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as Partial<InstallationTokenResponse> & { message?: string };

    if (!response.ok || !payload.token || !payload.expires_at) {
      throw new GitHubApiError(payload.message ?? "Failed to create GitHub App installation token.", response.status);
    }

    this.installationToken = {
      expiresAt: new Date(payload.expires_at).getTime(),
      token: payload.token,
    };

    return payload.token;
  }
}
