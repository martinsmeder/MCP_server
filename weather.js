import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "weather-server", version: "1.0.0" });

server.registerTool(
  "get_coordinates",
  {
    description: "Get latitude and longitude for a city name.",
    inputSchema: { city: z.string() },
  },
  async ({ city }) => {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    );
    const data = await response.json();
    const result = data?.results?.[0];

    const { latitude, longitude, name, country } = result;
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

server.registerTool(
  "get_weather",
  {
    description: "Get the current temperature for a latitude and longitude.",
    inputSchema: { latitude: z.number(), longitude: z.number() },
  },
  async ({ latitude, longitude }) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
    );
    const data = await response.json();
    const temperature = data?.current?.temperature_2m;
    const unit = data?.current_units?.temperature_2m;

    return {
      content: [
        { type: "text", text: `Current temperature: ${temperature}${unit}` },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
