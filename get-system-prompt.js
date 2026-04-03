import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "fs/promises";

const server = new McpServer({
  name: "system-prompt-server",
  version: "1.0.0",
});

server.registerTool(
  "get_system_prompt",
  {
    description:
      "Get the full system prompt and knowledge base for the Claude & Claude law firm.",
    inputSchema: {},
  },
  async () => {
    const content = await readFile("SYSTEM-PROMPT.md", "utf-8");
    return {
      content: [{ type: "text", text: content }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
