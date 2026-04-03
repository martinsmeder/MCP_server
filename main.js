import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWeatherTool } from "./get-weather.js";
import { registerSystemPromptTool } from "./get-system-prompt.js";

const server = new McpServer({ name: "main-server", version: "1.0.0" });

registerWeatherTool(server);
registerSystemPromptTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
