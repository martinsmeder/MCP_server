# MCP_server

A basic MCP server written in JavaScript.

### Exposed tools

- `get_weather`: retrieves the current weather for a specific city
- `get_system_prompt`: retrieves the LLM instructions and knowledge base (~10k tokens) for a fictitious law firm called Claude & Claude

### Why use MCP?

- To enable your AI agent to easily access tools, prompts and other resources across multiple projects

### Test via the inspector:

```bash
npm install
npx @modelcontextprotocol/inspector node main.js
```
