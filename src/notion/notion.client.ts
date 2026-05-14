import { Client } from "@notionhq/client";

export function createNotionClient(auth: string): Client {
  return new Client({ auth });
}
