import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toFastifyInjectUrl } from "../../src/server/vercel-adapter.js";

type VercelConfig = {
  rewrites: Array<{ destination: string; source: string }>;
};

describe("Vercel adapter", () => {
  it("maps the explicit health function to the Fastify health route", () => {
    expect(toFastifyInjectUrl("https://agent-office.example.com/api/health", "/health")).toBe("/health");
  });

  it("maps the explicit ready tasks function to the existing API route", () => {
    expect(
      toFastifyInjectUrl(
        "https://agent-office.example.com/api/agent-office/tasks/ready-for-architecture",
        "/agent-office/tasks/ready-for-architecture",
      ),
    ).toBe("/agent-office/tasks/ready-for-architecture");
  });

  it("maps the explicit Implementation Desk function to the existing API route", () => {
    expect(
      toFastifyInjectUrl(
        "https://agent-office.example.com/api/agent-office/codex-handoff",
        "/agent-office/codex-handoff",
      ),
    ).toBe("/agent-office/codex-handoff");
  });

  it("preserves query strings when mapping explicit Vercel functions", () => {
    expect(toFastifyInjectUrl("https://agent-office.example.com/api/health?check=smoke", "/health")).toBe(
      "/health?check=smoke",
    );
  });

  it("declares explicit Vercel rewrites for every production route", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as VercelConfig;

    expect(config.rewrites).toEqual(
      expect.arrayContaining([
        { source: "/health", destination: "/api/health" },
        { source: "/office", destination: "/api/office" },
        {
          source: "/agent-office/tasks/ready-for-architecture",
          destination: "/api/agent-office/tasks/ready-for-architecture",
        },
        {
          source: "/agent-office/tasks/ready-for-codex",
          destination: "/api/agent-office/tasks/ready-for-codex",
        },
        { source: "/agent-office/architect-review", destination: "/api/agent-office/architect-review" },
        { source: "/agent-office/architect-review/approve", destination: "/api/agent-office/architect-review/approve" },
        { source: "/agent-office/codex-handoff", destination: "/api/agent-office/codex-handoff" },
        { source: "/agent-office/codex-handoff/approve", destination: "/api/agent-office/codex-handoff/approve" },
        { source: "/agent-office/run-ready-architecture", destination: "/api/agent-office/run-ready-architecture" },
      ]),
    );
  });
});
