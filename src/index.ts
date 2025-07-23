#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools.js";
import { handleToolCall } from "./handlers.js";

// Create MCP server instance
const server = new Server(
  {
    name: "electron-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[MCP] Listing tools request received");
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error(
    `[MCP] Tool call request: ${request.params.name} with args:`,
    JSON.stringify(request.params.arguments, null, 2)
  );
  const result = await handleToolCall(request);
  console.error(`[MCP] Tool call result:`, JSON.stringify(result, null, 2));
  return result;
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  console.error("[MCP] Electron MCP Server starting...");
  await server.connect(transport);
  console.error("[MCP] Electron MCP Server running on stdio");
  console.error("[MCP] Available tools:", tools.map((t) => t.name).join(", "));
}

main().catch((error) => {
  console.error("[MCP] Server error:", error);
  process.exit(1);
});
