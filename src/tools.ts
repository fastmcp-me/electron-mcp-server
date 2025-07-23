import { zodToJsonSchema } from "zod-to-json-schema";
import {
  LaunchElectronAppSchema,
  CloseElectronAppSchema,
  BuildElectronAppSchema,
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
  ToolInput,
} from "./schemas.js";

// Tool name enumeration
export enum ToolName {
  LAUNCH_ELECTRON_APP = "launch_electron_app",
  CLOSE_ELECTRON_APP = "close_electron_app",
  BUILD_ELECTRON_APP = "build_electron_app",
  SEND_COMMAND_TO_ELECTRON = "send_command_to_electron",
  TAKE_SCREENSHOT = "take_screenshot",
  READ_ELECTRON_LOGS = "read_electron_logs",
  GET_ELECTRON_WINDOW_INFO = "get_electron_window_info",
}

// Define tools available to the MCP server
export const tools = [
  {
    name: ToolName.LAUNCH_ELECTRON_APP,
    description: "Launch an Electron application with optional debugging and remote control capabilities",
    inputSchema: zodToJsonSchema(LaunchElectronAppSchema) as ToolInput,
  },
  {
    name: ToolName.CLOSE_ELECTRON_APP,
    description: "Close the currently running Electron application",
    inputSchema: zodToJsonSchema(CloseElectronAppSchema) as ToolInput,
  },
  {
    name: ToolName.BUILD_ELECTRON_APP,
    description: "Build an Electron application for distribution on Windows or macOS",
    inputSchema: zodToJsonSchema(BuildElectronAppSchema) as ToolInput,
  },
  {
    name: ToolName.SEND_COMMAND_TO_ELECTRON,
    description: "Send a command or message to the running Electron process",
    inputSchema: zodToJsonSchema(SendCommandToElectronSchema) as ToolInput,
  },
  {
    name: ToolName.TAKE_SCREENSHOT,
    description: "Take a screenshot of the Electron application window (supports Windows and macOS)",
    inputSchema: zodToJsonSchema(TakeScreenshotSchema) as ToolInput,
  },
  {
    name: ToolName.READ_ELECTRON_LOGS,
    description: "Read logs from the Electron application (console, main process, renderer process)",
    inputSchema: zodToJsonSchema(ReadElectronLogsSchema) as ToolInput,
  },
  {
    name: ToolName.GET_ELECTRON_WINDOW_INFO,
    description: "Get information about Electron application windows",
    inputSchema: zodToJsonSchema(GetElectronWindowInfoSchema) as ToolInput,
  },
];
