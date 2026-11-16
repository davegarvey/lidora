## MODIFIED Requirements

### Requirement: Single-use connection URLs

The installed app SHALL be able to mint, using the master sync key, a connection ID that is bound to the sync key, single-use and valid for ten minutes. The app SHALL present the ID as `<origin>/mcp/c/<id>`. That path SHALL serve the same MCP tools before and after the ID is used, with OAuth tokens bound to its own resource audience.

#### Scenario: Mint a connection URL
- **WHEN** the user taps Connect an agent
- **THEN** the app SHALL show a primary action that copies setup instructions containing `<origin>/mcp/c/<id>`
- **AND** SHALL show the URL beneath it as a secondary option with its own copy action
- **AND** SHALL state the link's expiry
- **AND** SHALL NOT write to the clipboard until the user chooses a copy action

#### Scenario: Panel makes no claims about the agent's flow
- **WHEN** the connection link is shown
- **THEN** the panel SHALL say only where to paste the instructions and when the link expires
- **AND** SHALL NOT describe the steps the agent or its app will ask the user to take

#### Scenario: Spent URL still serves MCP
- **WHEN** a client holding a valid access token calls `<origin>/mcp/c/<id>` after the ID has been used
- **THEN** the server SHALL serve the request exactly as `/mcp` would

### Requirement: Client-neutral setup instructions

The setup instructions SHALL describe Lidora as a remote MCP server using the Streamable HTTP transport and OAuth, give the connection URL, ask the agent to add it as a server named "lidora" available across the user's projects and to start the sign-in, and ask agents that cannot change their own configuration to say where the user should add the URL and to repeat the URL with those directions. They SHALL NOT name particular clients, prescribe the user's sign-in steps, or ask the agent to fetch anything.

#### Scenario: Agent with a shell
- **WHEN** the user pastes the instructions into a coding agent that can manage its MCP configuration
- **THEN** the instructions SHALL give it everything needed to add the server and start the OAuth sign-in

#### Scenario: Chat-only agent
- **WHEN** the user pastes the instructions into an agent that cannot change its configuration
- **THEN** the instructions SHALL ask it to tell the user where to add the URL
- **AND** to include the URL in that reply
