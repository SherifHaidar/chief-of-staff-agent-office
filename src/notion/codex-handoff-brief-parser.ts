import { z } from "zod";

import { CodexHandoffBriefSchema, type CodexHandoffBrief } from "../domain/codex-handoff-brief.js";

const HANDOFF_HEADING_PREFIX = "## Codex Handoff Brief:";
const AGENT_OFFICE_HEADING_PREFIXES = [
  "## Architect Brief:",
  "## Codex Handoff Brief:",
  "## GitHub Draft PR:",
  "## Controlled Implementation Draft PR:",
  "## Implementation Work-Order Draft PR:",
] as const;

const SECTION_TITLES = {
  acceptanceChecklist: "Acceptance Checklist",
  constraints: "Constraints / Do Not Change",
  explicitApprovalWarnings: "Merge / Deploy Approval Warnings",
  implementationScope: "Implementation Scope",
  implementationSteps: "Implementation Steps",
  likelyAffectedFiles: "Likely Affected Files or Modules",
  problemSummary: "Problem Summary",
  productIntent: "Product Intent",
  suggestedBranchName: "Suggested Branch Name",
  suggestedPrBody: "Suggested PR Body",
  suggestedPrTitle: "Suggested PR Title",
  targetProductRepo: "Target Product Repo",
  testsToRun: "Tests to Run",
} as const;

export class CodexHandoffBriefParseError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "CodexHandoffBriefParseError";
  }
}

function stripListMarker(line: string): string {
  return line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function sectionText(sections: Map<string, string[]>, title: string): string {
  return (sections.get(title) ?? []).join("\n").trim();
}

function sectionList(sections: Map<string, string[]>, title: string): string[] {
  return (sections.get(title) ?? [])
    .map(stripListMarker)
    .filter((line) => line.length > 0 && line !== "None.");
}

function latestCodexHandoffLines(markdown: string): { headingTitle: string; lines: string[] } {
  const lines = markdown.split(/\r?\n/);
  const starts = lines
    .map((line, index) => ({ index, line: line.trim() }))
    .filter((item) => item.line.startsWith(HANDOFF_HEADING_PREFIX));
  const latest = starts.at(-1);

  if (!latest) {
    throw new CodexHandoffBriefParseError("No approved Codex Handoff Brief marker was found on the task page.");
  }

  const end = lines.findIndex(
    (line, index) =>
      index > latest.index && AGENT_OFFICE_HEADING_PREFIXES.some((prefix) => line.trim().startsWith(prefix)),
  );
  const contentEnd = end === -1 ? lines.length : end;
  const headingTitle = latest.line.slice(HANDOFF_HEADING_PREFIX.length).trim();

  return {
    headingTitle,
    lines: lines.slice(latest.index + 1, contentEnd),
  };
}

function parseSections(lines: string[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentTitle: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "---") {
      continue;
    }

    if (line.startsWith("### ")) {
      currentTitle = line.slice(4).trim();
      if (!sections.has(currentTitle)) {
        sections.set(currentTitle, []);
      }
      continue;
    }

    if (currentTitle) {
      sections.get(currentTitle)?.push(line);
    }
  }

  return sections;
}

export function parseLatestCodexHandoffBrief(markdown: string): CodexHandoffBrief {
  const latest = latestCodexHandoffLines(markdown);
  const sections = parseSections(latest.lines);
  const parsed = {
    acceptanceChecklist: sectionList(sections, SECTION_TITLES.acceptanceChecklist),
    constraints: sectionList(sections, SECTION_TITLES.constraints),
    explicitApprovalWarnings: sectionList(sections, SECTION_TITLES.explicitApprovalWarnings),
    implementationScope: sectionList(sections, SECTION_TITLES.implementationScope),
    implementationSteps: sectionList(sections, SECTION_TITLES.implementationSteps),
    likelyAffectedFiles: sectionList(sections, SECTION_TITLES.likelyAffectedFiles),
    problemSummary: sectionText(sections, SECTION_TITLES.problemSummary),
    productIntent: sectionText(sections, SECTION_TITLES.productIntent),
    suggestedBranchName: sectionText(sections, SECTION_TITLES.suggestedBranchName),
    suggestedPrBody: sectionText(sections, SECTION_TITLES.suggestedPrBody),
    suggestedPrTitle: sectionText(sections, SECTION_TITLES.suggestedPrTitle) || latest.headingTitle,
    targetProductRepo: sectionText(sections, SECTION_TITLES.targetProductRepo),
    testsToRun: sectionList(sections, SECTION_TITLES.testsToRun),
  };

  try {
    return CodexHandoffBriefSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CodexHandoffBriefParseError(
        "Approved Codex Handoff Brief exists, but it could not be parsed into the v0 structured handoff format.",
      );
    }

    throw error;
  }
}
