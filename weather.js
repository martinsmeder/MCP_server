import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "weather-server", version: "1.0.0" });

server.registerTool(
  "get_weather",
  {
    description: "Get the current temperature for a city.",
    inputSchema: { city: z.string() },
  },
  async ({ city }) => {
    const geocodeResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    );
    const geocodeData = await geocodeResponse.json();
    const location = geocodeData.results[0];

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m`,
    );
    const weatherData = await weatherResponse.json();
    const temperature = weatherData.current.temperature_2m;
    const unit = weatherData.current_units.temperature_2m;

    return {
      content: [
        {
          type: "text",
          text: `Current temperature in ${location.name}: ${temperature}${unit}`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
