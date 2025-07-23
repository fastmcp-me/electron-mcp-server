import { z } from "zod";

// Schema definitions for tool inputs
export const LaunchElectronAppSchema = z.object({
  appPath: z.string().describe("Path to the Electron application"),
  args: z
    .array(z.string())
    .optional()
    .describe("Additional command line arguments"),
  devMode: z
    .boolean()
    .optional()
    .describe("Launch in development mode with debugging"),
});

export const CloseElectronAppSchema = z.object({
  force: z
    .boolean()
    .optional()
    .describe("Force close if the application is unresponsive"),
});

export const BuildElectronAppSchema = z.object({
  projectPath: z.string().describe("Path to the Electron project"),
  platform: z
    .enum(["win32", "darwin"])
    .optional()
    .describe("Target platform (Windows or macOS only)"),
  arch: z
    .enum(["x64", "arm64", "ia32"])
    .optional()
    .describe("Target architecture"),
  debug: z.boolean().optional().describe("Build in debug mode"),
});

export const SendCommandToElectronSchema = z.object({
  command: z.string().describe("Command to send to the Electron process"),
  args: z.any().optional().describe("Arguments for the command"),
});

export const TakeScreenshotSchema = z.object({
  outputPath: z
    .string()
    .optional()
    .describe(
      "Path to save the screenshot (optional, defaults to temp directory)"
    ),
  windowTitle: z
    .string()
    .optional()
    .describe("Specific window title to screenshot (optional)"),
});

export const ReadElectronLogsSchema = z.object({
  logType: z
    .enum(["console", "main", "renderer", "all"])
    .optional()
    .describe("Type of logs to read"),
  lines: z
    .number()
    .optional()
    .describe("Number of recent lines to read (default: 100)"),
  follow: z.boolean().optional().describe("Whether to follow/tail the logs"),
});

export const GetElectronWindowInfoSchema = z.object({
  includeChildren: z
    .boolean()
    .optional()
    .describe("Include child windows information"),
});

// Type helper for tool input schema
export type ToolInput = {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
};
