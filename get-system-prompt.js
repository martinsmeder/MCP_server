import { readFile } from "fs/promises";

export function registerSystemPromptTool(server) {
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
}
