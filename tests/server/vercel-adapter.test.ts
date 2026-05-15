import { describe, expect, it } from "vitest";

import { toFastifyInjectUrl } from "../../src/server/vercel-adapter.js";

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

  it("preserves query strings when mapping explicit Vercel functions", () => {
    expect(toFastifyInjectUrl("https://agent-office.example.com/api/health?check=smoke", "/health")).toBe(
      "/health?check=smoke",
    );
  });
});
