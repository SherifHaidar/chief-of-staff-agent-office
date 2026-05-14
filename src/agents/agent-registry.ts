import { OpenAIArchitectAgentRunner, type ArchitectAgentRunner } from "./architect.agent.js";

export type AgentRegistry = {
  architect: ArchitectAgentRunner;
};

export function createAgentRegistry(config: { model?: string } = {}): AgentRegistry {
  return {
    architect: new OpenAIArchitectAgentRunner({ model: config.model }),
  };
}
