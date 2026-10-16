import { describe, expect, it } from 'vitest';
import { agentSetupPrompt } from '../src/agents/setupPrompt';

describe('agentSetupPrompt', () => {
  const prompt = agentSetupPrompt('https://lidora.example/mcp/c/abc');

  it('gives an agent everything it needs without naming a client', () => {
    expect(prompt).toContain('Server URL: https://lidora.example/mcp/c/abc');
    expect(prompt).toContain('remote MCP server');
    expect(prompt).toContain('Streamable HTTP');
    expect(prompt).toContain('OAuth');
    expect(prompt).toContain('named "lidora"');
    expect(prompt).toContain('all my projects');
    expect(prompt).toContain('custom connector');
    expect(prompt).not.toMatch(/codex|claude|opencode|cursor|copilot|gemini/i);
  });

  it('leaves sign-in steps to the agent and asks chat-only agents to repeat the URL', () => {
    expect(prompt).not.toMatch(/tap Allow|will open/i);
    expect(prompt).toContain('repeat the URL');
  });

  it('asks the agent to configure itself rather than fetch anything', () => {
    expect(prompt).not.toMatch(/fetch|download|curl/i);
    expect(prompt.match(/https?:\/\//g)).toHaveLength(1);
  });
});
