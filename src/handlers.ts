import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolName } from "./tools.js";
import {
  LaunchElectronAppSchema,
  CloseElectronAppSchema,
  BuildElectronAppSchema,
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
} from "./schemas.js";
import {
  launchElectronApp,
  closeElectronApp,
  buildElectronApp,
  sendCommandToElectron,
  getElectronWindowInfo,
} from "./utils/process.js";
import { takeScreenshot } from "./screenshot.js";
import { readElectronLogs } from "./utils/logs.js";
import { isElectronInstalled } from "./utils/project.js";

export async function handleToolCall(
  request: z.infer<typeof CallToolRequestSchema>
) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case ToolName.LAUNCH_ELECTRON_APP: {
        const {
          appPath,
          args: launchArgs,
          devMode,
        } = LaunchElectronAppSchema.parse(args);

        // Check if Electron is installed
        const electronAvailable = await isElectronInstalled(appPath);
        if (!electronAvailable) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Electron is not installed. Please install Electron globally (npm install -g electron) or locally in your project.",
              },
            ],
          };
        }

        const result = await launchElectronApp(appPath, launchArgs, devMode);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case ToolName.CLOSE_ELECTRON_APP: {
        const { force } = CloseElectronAppSchema.parse(args);
        const result = await closeElectronApp(force);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case ToolName.BUILD_ELECTRON_APP: {
        const { projectPath, platform, arch, debug } =
          BuildElectronAppSchema.parse(args);
        const result = await buildElectronApp(
          projectPath,
          platform,
          arch,
          debug
        );
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case ToolName.SEND_COMMAND_TO_ELECTRON: {
        const { command, args: commandArgs } =
          SendCommandToElectronSchema.parse(args);
        const result = await sendCommandToElectron(command, commandArgs);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case ToolName.TAKE_SCREENSHOT: {
        const { outputPath, windowTitle } = TakeScreenshotSchema.parse(args);
        const result = await takeScreenshot(outputPath, windowTitle);

        // Read the screenshot file and convert to base64
        const fs = await import("fs/promises");
        const imageBuffer = await fs.readFile(result);
        const base64Image = imageBuffer.toString("base64");

        return {
          content: [
            { type: "text", text: `Screenshot saved to: ${result}` },
            {
              type: "image",
              data: base64Image,
              mimeType: "image/png",
            },
          ],
        };
      }

      case ToolName.READ_ELECTRON_LOGS: {
        const { logType, lines, follow } = ReadElectronLogsSchema.parse(args);
        const logs = await readElectronLogs(logType, lines);

        if (follow) {
          return {
            content: [
              {
                type: "text",
                text: `Following logs (showing last ${
                  lines || 100
                } lines):\n\n${logs.join(
                  "\n"
                )}\n\n[Log following is not implemented in this version - showing current logs only]`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Electron logs (last ${lines || 100} lines):\n\n${logs.join(
                "\n"
              )}`,
            },
          ],
        };
      }

      case ToolName.GET_ELECTRON_WINDOW_INFO: {
        const { includeChildren } = GetElectronWindowInfoSchema.parse(args);
        const result = await getElectronWindowInfo(includeChildren);
        return {
          content: [
            {
              type: "text",
              text: `Window Information:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
