# MCP_server

Minimal Groq + MCP example in JavaScript.

Files:
- `main.js`: Groq client that discovers tools from local MCP servers, lets the model call them, and prints the final answer.
- `hello-world.js`: MCP server with a `say_hello` tool.
- `weather.js`: MCP server with `get_coordinates` and `get_weather`.

Run:

```bash
node main.js
```

Requires `GROQ_API_KEY` in `.env`.
