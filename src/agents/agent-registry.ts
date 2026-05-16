import { OpenAIArchitectAgentRunner, type ArchitectAgentRunner } from "./architect.agent.js";
import { OpenAICodexHandoffAgentRunner, type CodexHandoffAgentRunner } from "./codex-handoff.agent.js";
import { OpenAIImplementationAgentRunner, type ImplementationAgentRunner } from "./implementation.agent.js";

export type AgentRegistry = {
  architect: ArchitectAgentRunner;
  codexHandoff: CodexHandoffAgentRunner;
  implementation: ImplementationAgentRunner;
};

export function createAgentRegistry(config: { model?: string } = {}): AgentRegistry {
  return {
    architect: new OpenAIArchitectAgentRunner({ model: config.model }),
    codexHandoff: new OpenAICodexHandoffAgentRunner({ model: config.model }),
    implementation: new OpenAIImplementationAgentRunner({ model: config.model }),
  };
}
