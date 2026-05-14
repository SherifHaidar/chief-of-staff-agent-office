export type NotionTaskProperties = Record<string, unknown>;

export type AiBuildTask = {
  contentMarkdown: string;
  pageId: string;
  properties: NotionTaskProperties;
  status?: string;
  title: string;
  url?: string;
};

export function formatTaskForArchitect(task: AiBuildTask): string {
  return JSON.stringify(
    {
      body: task.contentMarkdown || "No page body content was found.",
      pageId: task.pageId,
      status: task.status ?? null,
      title: task.title,
      url: task.url ?? null,
    },
    null,
    2,
  );
}
