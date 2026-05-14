import { describe, expect, it } from "vitest";

import { toFastifyInjectUrl } from "../../api/[...path].js";

describe("Vercel adapter", () => {
  it("maps rewritten health requests back to the Fastify health route", () => {
    expect(toFastifyInjectUrl("https://agent-office.example.com/api/health")).toBe("/health");
  });

  it("maps rewritten Agent Office requests back to the existing API route", () => {
    expect(toFastifyInjectUrl("https://agent-office.example.com/api/agent-office/tasks/ready-for-architecture"))
      .toBe("/agent-office/tasks/ready-for-architecture");
  });

  it("preserves query strings when mapping Vercel function paths", () => {
    expect(toFastifyInjectUrl("https://agent-office.example.com/api/health?check=smoke")).toBe("/health?check=smoke");
  });
});
