# MCP_server

Minimal Groq + MCP example in JavaScript.

Files:

- `main.js`: Groq client that connects to the weather MCP, exposes its tools to the model, and prints the final answer.
- `weather.js`: MCP server with `get_coordinates` and `get_weather`.

Run:

```bash
node main.js
```

Requires `GROQ_API_KEY` in `.env`.
