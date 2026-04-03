import process from "node:process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Groq from "groq-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const envPath = fileURLToPath(new URL("./.env", import.meta.url));

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const helloServerPath = fileURLToPath(
  new URL("./hello-world.js", import.meta.url),
);
const weatherServerPath = fileURLToPath(
  new URL("./weather.js", import.meta.url),
);

function createMcpClient(name, script) {
  const client = new Client({ name: `${name}-client`, version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "bash",
    args: ["-lc", `exec '${process.execPath}' '${script}'`],
    stderr: "inherit",
    env: process.env,
  });

  return { name, client, transport };
}

async function connectServer(server) {
  await server.client.connect(server.transport);
  const { tools } = await server.client.listTools();
  return tools.map((tool) => ({
    ...tool,
    mcpServer: server.name,
  }));
}

function formatToolResult(result) {
  if ("toolResult" in result) {
    return JSON.stringify(result.toolResult);
  }

  const text = result.content
    .map((item) => {
      if (item.type === "text") return item.text;
      return JSON.stringify(item);
    })
    .join("\n");

  return text || JSON.stringify(result);
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const servers = [
    createMcpClient("hello", helloServerPath),
    createMcpClient("weather", weatherServerPath),
  ];

  try {
    const discoveredTools = (
      await Promise.all(servers.map(connectServer))
    ).flat();
    const toolMap = new Map();

    const groqTools = discoveredTools.map((tool) => {
      const groqName = `${tool.mcpServer}__${tool.name}`;
      const server = servers.find(
        (candidate) => candidate.name === tool.mcpServer,
      );

      if (!server) {
        throw new Error(`Missing MCP server for tool: ${tool.name}`);
      }

      toolMap.set(groqName, {
        client: server.client,
        mcpName: tool.name,
      });

      return {
        type: "function",
        function: {
          name: groqName,
          description:
            tool.description ?? `${tool.name} from ${tool.mcpServer}`,
          parameters: tool.inputSchema,
        },
      };
    });

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

    for (let step = 0; step < 6; step += 1) {
      const completion = await groq.chat.completions.create({
        model: "qwen/qwen3-32b",
        messages,
        tools: groqTools,
        tool_choice: "auto",
        parallel_tool_calls: true,
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error("Groq returned no message.");
      }

      messages.push(message);

      if (!message.tool_calls?.length) {
        console.log(message.content ?? "");
        return;
      }

      for (const toolCall of message.tool_calls) {
        const toolEntry = toolMap.get(toolCall.function.name);
        if (!toolEntry) {
          throw new Error(`Unknown tool: ${toolCall.function.name}`);
        }

        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch (error) {
          throw new Error(
            `Invalid tool arguments for ${toolCall.function.name}: ${String(error)}`,
          );
        }

        const result = await toolEntry.client.callTool({
          name: toolEntry.mcpName,
          arguments: args,
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: formatToolResult(result),
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
