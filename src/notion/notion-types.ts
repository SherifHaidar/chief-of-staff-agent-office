export type NotionAppendBlock = Record<string, unknown>;

export type NotionStatusPropertyType = "select" | "status";

export type NotionTaskRepositoryConfig = {
  maxReadDepth: number;
  statusPropertyName: string;
  statusPropertyType: NotionStatusPropertyType;
};

export type NotionClientLike = {
  blocks: {
    children: {
      append(args: { block_id: string; children: NotionAppendBlock[] }): Promise<unknown>;
      list(args: { block_id: string; page_size?: number; start_cursor?: string }): Promise<unknown>;
    };
  };
  pages: {
    retrieve(args: { page_id: string }): Promise<unknown>;
    update(args: { page_id: string; properties: Record<string, unknown> }): Promise<unknown>;
  };
};
