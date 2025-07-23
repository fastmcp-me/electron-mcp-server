import { zodToJsonSchema } from "zod-to-json-schema";
import {
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
  ToolInput,
} from "./schemas.js";

// Tool name enumeration
export enum ToolName {
  SEND_COMMAND_TO_ELECTRON = "send_command_to_electron",
  TAKE_SCREENSHOT = "take_screenshot",
  READ_ELECTRON_LOGS = "read_electron_logs",
  GET_ELECTRON_WINDOW_INFO = "get_electron_window_info",
}

// Define tools available to the MCP server
export const tools = [
  {
    name: ToolName.GET_ELECTRON_WINDOW_INFO,
    description: "Get information about running Electron applications and their windows. Automatically detects any Electron app with remote debugging enabled (port 9222).",
    inputSchema: zodToJsonSchema(GetElectronWindowInfoSchema) as ToolInput,
  },
  {
    name: ToolName.TAKE_SCREENSHOT,
    description: "Take a screenshot of any running Electron application window. Returns base64 image data for AI analysis. No files created unless outputPath is specified.",
    inputSchema: zodToJsonSchema(TakeScreenshotSchema) as ToolInput,
  },
  {
    name: ToolName.SEND_COMMAND_TO_ELECTRON,
    description: "Send JavaScript commands to any running Electron application via Chrome DevTools Protocol. Can click buttons, evaluate code, interact with DOM elements.",
    inputSchema: zodToJsonSchema(SendCommandToElectronSchema) as ToolInput,
  },
  {
    name: ToolName.READ_ELECTRON_LOGS,
    description: "Read console logs and output from running Electron applications. Useful for debugging and monitoring app behavior.",
    inputSchema: zodToJsonSchema(ReadElectronLogsSchema) as ToolInput,
  },
];
