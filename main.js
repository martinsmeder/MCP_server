import process from "node:process";
import "dotenv/config";
import Groq from "groq-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getText(result) {
  if ("toolResult" in result) return JSON.stringify(result.toolResult);
  return result.content
    .map((item) => item.text ?? JSON.stringify(item))
    .join("\n");
}

async function main() {
  const client = new Client({ name: "weather-client", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL("./weather.js", import.meta.url).pathname],
    stderr: "inherit",
    env: process.env,
  });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const response = await groq.chat.completions.create({
      model: "qwen/qwen3-32b",
      messages: [
        {
          role: "user",
          content: "Use the weather tool to get the current weather in Tokyo.",
        },
      ],
      tools: tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description ?? tool.name,
          parameters: tool.inputSchema,
        },
      })),
      tool_choice: "required",
    });

    const call = response.choices[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Groq did not call a tool.");

    const result = await client.callTool({
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments || "{}"),
    });

    console.log(getText(result));
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
