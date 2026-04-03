import process from "node:process";
import "dotenv/config";
import Groq from "groq-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function createServer(name, file) {
  return {
    name,
    client: new Client({ name: "mcp-client", version: "1.0.0" }),
    transport: new StdioClientTransport({
      command: process.execPath,
      args: [new URL(file, import.meta.url).pathname],
      stderr: "inherit",
      env: process.env,
    }),
  };
}

async function connectServers() {
  const servers = [
    createServer("hello", "./hello-world.js"),
    createServer("weather", "./weather.js"),
  ];

  for (const server of servers) {
    await server.client.connect(server.transport);
  }

  return servers;
}

async function getTools(servers) {
  const tools = [];
  const toolMap = new Map();

  for (const server of servers) {
    const { tools: serverTools } = await server.client.listTools();

    for (const tool of serverTools) {
      const name = `${server.name}__${tool.name}`;
      toolMap.set(name, { client: server.client, tool: tool.name });
      tools.push({
        type: "function",
        function: {
          name,
          description: tool.description ?? tool.name,
          parameters: tool.inputSchema,
        },
      });
    }
  }

  return { tools, toolMap };
}

function getText(result) {
  if ("toolResult" in result) return JSON.stringify(result.toolResult);
  return result.content
    .map((item) => item.text ?? JSON.stringify(item))
    .join("\n");
}

async function runAgent(tools, toolMap) {
  const messages = [
    {
      role: "system",
      content:
        "You are a small assistant that must use the available tools when they are relevant.",
    },
    {
      role: "user",
      content:
        "Use the tools to say hello to Martin, then find the current temperature in Tokyo. Return a short final answer with both results.",
    },
  ];

  for (let i = 0; i < 6; i += 1) {
    const response = await groq.chat.completions.create({
      model: "qwen/qwen3-32b",
      messages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: true,
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("Groq returned no message.");

    messages.push(message);

    if (!message.tool_calls?.length) {
      console.log(message.content ?? "");
      return;
    }

    for (const call of message.tool_calls) {
      const tool = toolMap.get(call.function.name);
      const result = await tool.client.callTool({
        name: tool.tool,
        arguments: JSON.parse(call.function.arguments || "{}"),
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: getText(result),
      });
    }
  }

  throw new Error("Exceeded tool loop limit.");
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const servers = await connectServers();

  try {
    const { tools, toolMap } = await getTools(servers);
    await runAgent(tools, toolMap);
  } finally {
    await Promise.allSettled(servers.map((server) => server.transport.close()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
