import process from "node:process";
import "dotenv/config";
import Groq from "groq-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverConfigs = [
  ["hello", new URL("./hello-world.js", import.meta.url).pathname],
  ["weather", new URL("./weather.js", import.meta.url).pathname],
];

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function createServer(name, script) {
  return {
    name,
    client: new Client({ name: `${name}-client`, version: "1.0.0" }),
    transport: new StdioClientTransport({
      command: process.execPath,
      args: [script],
      stderr: "inherit",
      env: process.env,
    }),
  };
}

function toolText(result) {
  if ("toolResult" in result) return JSON.stringify(result.toolResult);

  return result.content
    .map((item) => (item.type === "text" ? item.text : JSON.stringify(item)))
    .join("\n");
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const servers = serverConfigs.map(([name, script]) =>
    createServer(name, script),
  );
  const tools = [];
  const toolMap = new Map();

  try {
    for (const server of servers) {
      await server.client.connect(server.transport);
      const { tools: serverTools } = await server.client.listTools();

      for (const tool of serverTools) {
        const name = `${server.name}__${tool.name}`;
        toolMap.set(name, { client: server.client, name: tool.name });
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
        if (!tool) throw new Error(`Unknown tool: ${call.function.name}`);

        const args = JSON.parse(call.function.arguments || "{}");
        const result = await tool.client.callTool({
          name: tool.name,
          arguments: args,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolText(result),
        });
      }
    }

    throw new Error("Exceeded tool loop limit.");
  } finally {
    await Promise.allSettled(servers.map((server) => server.transport.close()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
