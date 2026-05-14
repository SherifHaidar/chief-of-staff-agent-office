import { Client } from "@notionhq/client";

import type { NotionClientLike } from "./notion-types.js";

export function createNotionClient(auth: string): NotionClientLike {
  return new Client({ auth }) as unknown as NotionClientLike;
}
