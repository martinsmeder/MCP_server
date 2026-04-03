import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server.
const server = new McpServer({ name: "weather-server", version: "1.0.0" });

// Tool 1: Get coordinates for a city.
server.registerTool(
  "get_coordinates",
  {
    description: "Get latitude and longitude for a city name",
    inputSchema: { city: z.string() },
  },
  async ({ city }) => {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`,
    );
    const data = await res.json();
    const { latitude, longitude, name, country } = data.results[0];
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ latitude, longitude, name, country }),
        },
      ],
    };
  },
);

// Tool 2: Get current temperature for coordinates.
server.registerTool(
  "get_weather",
  {
    description: "Get current temperature for a latitude and longitude",
    inputSchema: { latitude: z.number(), longitude: z.number() },
  },
  async ({ latitude, longitude }) => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
    );
    const data = await res.json();
    const temp = data.current.temperature_2m;
    const unit = data.current_units.temperature_2m;
    return {
      content: [{ type: "text", text: `Current temperature: ${temp}${unit}` }],
    };
  },
);

// Use stdin/stdout as the communication channel between client and server.
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Server running...");

// ----------------------------------------------------------------
// How to test:
// 1. run inspector: npx @modelcontextprotocol/inspector tsx weather.ts
// 2. then: connect --> list tools --> click [tool 1 name] --> add city --> run tool
//    --> click [tool 2 name] --> add latitude and longitude --> run tool
