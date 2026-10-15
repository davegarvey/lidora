export function agentSetupPrompt(url: string): string {
  return `Connect me to Lidora, my RSS reader, so you can read and manage my feeds.

Lidora is a remote MCP server (Streamable HTTP transport) that uses OAuth for sign-in.
Server URL: ${url}
The URL works for one sign-in within 10 minutes of being created. After that it stays valid as the server address.

If you can add MCP servers to your own configuration:
1. Add it as a remote MCP server named "lidora" with that URL, available in all my projects rather than only the current one.
2. Start the OAuth sign-in. A Lidora page will open in my browser, and I will tap Allow.
3. Confirm when it is done, and tell me if I need to start a new conversation or reload before Lidora's tools are available.

If you cannot change your own configuration, tell me where in your settings to add this URL as a custom connector or MCP server.`;
}
