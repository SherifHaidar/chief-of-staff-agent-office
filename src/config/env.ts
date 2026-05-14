import { z } from "zod";

const stringBoolean = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}, z.boolean());

export const AppEnvSchema = z.object({
  DRY_RUN: stringBoolean.default(false),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NOTION_MAX_READ_DEPTH: z.coerce.number().int().min(0).max(10).default(3),
  NOTION_READY_FOR_ARCHITECTURE_STATUS: z.string().min(1).default("Ready for Architecture"),
  NOTION_STATUS_AFTER_ARCHITECT: z.string().min(1).default("Ready for Codex"),
  NOTION_STATUS_PROPERTY: z.string().min(1).default("Status"),
  NOTION_STATUS_PROPERTY_TYPE: z.enum(["status", "select"]).default("select"),
  NOTION_TASK_DATABASE_ID: z.string().optional(),
  NOTION_TOKEN: z.string().min(1, "NOTION_TOKEN is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4"),
  RUN_LOG_PATH: z.string().min(1).default("data/run-log.jsonl"),
});

export type AppEnv = z.infer<typeof AppEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return AppEnvSchema.parse(source);
}
