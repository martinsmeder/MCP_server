import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server.
const server = new McpServer({ name: "hello-server", version: "1.0.0" });

// Add tool.
server.registerTool(
  "say_hello",
  { description: "Says hello", inputSchema: { name: z.string() } },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}!` }],
  }),
);

// Use stdin (standard input) and stdout (standard output) for communication
// between client and server. Then, connect to the server.
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Server running...");

// ----------------------------------------------------------------
// How to test:
// 1. run inspector: npx @modelcontextprotocol/inspector tsx test.ts
// 2. then: connect --> list tools --> click [tool name] --> add name --> run tool
