import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolName } from "./tools.js";
import {
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
} from "./schemas.js";
import { sendCommandToElectron } from "./utils/electron-enhanced-commands.js";
import { getElectronWindowInfo } from "./utils/electron-discovery.js";
import { readElectronLogs } from "./utils/electron-logs.js";
import { takeScreenshot } from "./screenshot.js";

export async function handleToolCall(
  request: z.infer<typeof CallToolRequestSchema>
) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
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

      case ToolName.TAKE_SCREENSHOT: {
        const { outputPath, windowTitle } = TakeScreenshotSchema.parse(args);
        const result = await takeScreenshot(outputPath, windowTitle);

        // Return the screenshot as base64 data for AI to evaluate
        const content: any[] = [];
        
        if (result.filePath) {
          content.push({ 
            type: "text", 
            text: `Screenshot saved to: ${result.filePath}` 
          });
        } else {
          content.push({ 
            type: "text", 
            text: "Screenshot captured in memory (no file saved)" 
          });
        }
        
        // Add the image data for AI evaluation
        content.push({
          type: "image",
          data: result.base64!,
          mimeType: "image/png",
        });

        return { content };
      }

      case ToolName.SEND_COMMAND_TO_ELECTRON: {
        const { command, args: commandArgs } =
          SendCommandToElectronSchema.parse(args);
        const result = await sendCommandToElectron(command, commandArgs);
        return {
          content: [{ type: "text", text: result }],
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
                text: `Following logs (${logType}). This is a snapshot of recent logs:\n\n${logs}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Electron logs (${logType}):\n\n${logs}`,
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
