import { OpenAIArchitectAgentRunner, type ArchitectAgentRunner } from "./architect.agent.js";
import { OpenAICodexHandoffAgentRunner, type CodexHandoffAgentRunner } from "./codex-handoff.agent.js";

export type AgentRegistry = {
  architect: ArchitectAgentRunner;
  codexHandoff: CodexHandoffAgentRunner;
};

export function createAgentRegistry(config: { model?: string } = {}): AgentRegistry {
  return {
    architect: new OpenAIArchitectAgentRunner({ model: config.model }),
    codexHandoff: new OpenAICodexHandoffAgentRunner({ model: config.model }),
  };
}
