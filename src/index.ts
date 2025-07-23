#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type helper for tool input schema
type ToolInput = z.infer<typeof ToolSchema>["inputSchema"];

// Electron process management
let electronProcess: ChildProcess | null = null;

// Schema definitions for tool inputs
const LaunchElectronAppSchema = z.object({
  appPath: z.string().describe("Path to the Electron application"),
  args: z.array(z.string()).optional().default([]).describe("Additional command line arguments"),
  devMode: z.boolean().optional().default(false).describe("Launch in development mode")
});

const CloseElectronAppSchema = z.object({
  force: z.boolean().optional().default(false).describe("Force close the application")
});

const GetElectronInfoSchema = z.object({});

const CreateElectronProjectSchema = z.object({
  projectName: z.string().describe("Name of the new Electron project"),
  projectPath: z.string().describe("Path where to create the project"),
  template: z.enum(["basic", "react", "vue", "angular"]).optional().default("basic").describe("Project template to use")
});

const BuildElectronAppSchema = z.object({
  projectPath: z.string().describe("Path to the Electron project"),
  platform: z.enum(["win32", "darwin", "linux"]).optional().describe("Target platform for build"),
  arch: z.enum(["x64", "arm64", "ia32"]).optional().describe("Target architecture"),
  debug: z.boolean().optional().default(false).describe("Build in debug mode")
});

const GetElectronProcessInfoSchema = z.object({});

const SendCommandToElectronSchema = z.object({
  command: z.string().describe("Command to send to the Electron process"),
  args: z.any().optional().describe("Arguments for the command")
});

// Tool name enumeration
enum ToolName {
  LAUNCH_ELECTRON_APP = "launch_electron_app",
  CLOSE_ELECTRON_APP = "close_electron_app", 
  GET_ELECTRON_INFO = "get_electron_info",
  CREATE_ELECTRON_PROJECT = "create_electron_project",
  BUILD_ELECTRON_APP = "build_electron_app",
  GET_ELECTRON_PROCESS_INFO = "get_electron_process_info",
  SEND_COMMAND_TO_ELECTRON = "send_command_to_electron"
}

// Helper functions
async function checkElectronInstalled(): Promise<boolean> {
  try {
    const { execSync } = await import("child_process");
    execSync("electron --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function createBasicElectronProject(projectPath: string, projectName: string): Promise<void> {
  // Create directory structure
  await fs.mkdir(projectPath, { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    description: "A minimal Electron application",
    main: "main.js",
    scripts: {
      start: "electron .",
      dev: "electron . --dev",
      build: "electron-builder"
    },
    devDependencies: {
      electron: "^latest"
    }
  };
  
  await fs.writeFile(
    path.join(projectPath, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create main.js
  const mainJs = `const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
`;
  
  await fs.writeFile(path.join(projectPath, "main.js"), mainJs);
  
  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${projectName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      font-size: 2.5em;
      margin-bottom: 20px;
    }
    p {
      font-size: 1.2em;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to ${projectName}</h1>
    <p>This is a basic Electron application created via MCP!</p>
    <p>You can start building your amazing desktop app from here.</p>
  </div>
</body>
</html>
`;
  
  await fs.writeFile(path.join(projectPath, "index.html"), indexHtml);
}

// Server setup
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

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: ToolName.LAUNCH_ELECTRON_APP,
      description: "Launch an Electron application from a given path. Can launch in development mode with additional debugging features.",
      inputSchema: zodToJsonSchema(LaunchElectronAppSchema) as ToolInput,
    },
    {
      name: ToolName.CLOSE_ELECTRON_APP,
      description: "Close the currently running Electron application. Can force close if the app is unresponsive.",
      inputSchema: zodToJsonSchema(CloseElectronAppSchema) as ToolInput,
    },
    {
      name: ToolName.GET_ELECTRON_INFO,
      description: "Get information about the Electron installation, including version and available features.",
      inputSchema: zodToJsonSchema(GetElectronInfoSchema) as ToolInput,
    },
    {
      name: ToolName.CREATE_ELECTRON_PROJECT,
      description: "Create a new Electron project with a basic structure. Supports different templates for various frameworks.",
      inputSchema: zodToJsonSchema(CreateElectronProjectSchema) as ToolInput,
    },
    {
      name: ToolName.BUILD_ELECTRON_APP,
      description: "Build an Electron application for distribution. Supports multiple platforms and architectures.",
      inputSchema: zodToJsonSchema(BuildElectronAppSchema) as ToolInput,
    },
    {
      name: ToolName.GET_ELECTRON_PROCESS_INFO,
      description: "Get information about the currently running Electron process, including PID and status.",
      inputSchema: zodToJsonSchema(GetElectronProcessInfoSchema) as ToolInput,
    },
    {
      name: ToolName.SEND_COMMAND_TO_ELECTRON,
      description: "Send a command to the running Electron application. Useful for automation and testing.",
      inputSchema: zodToJsonSchema(SendCommandToElectronSchema) as ToolInput,
    },
  ];

  return { tools };
});

// Tool implementations
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case ToolName.LAUNCH_ELECTRON_APP: {
        const { appPath, args: appArgs, devMode } = LaunchElectronAppSchema.parse(args);
        
        if (electronProcess) {
          return {
            content: [{ 
              type: "text", 
              text: "An Electron application is already running. Please close it first." 
            }],
            isError: true,
          };
        }
        
        // Check if Electron is installed
        const electronInstalled = await checkElectronInstalled();
        if (!electronInstalled) {
          return {
            content: [{ 
              type: "text", 
              text: "Electron is not installed. Please install Electron first: npm install -g electron" 
            }],
            isError: true,
          };
        }
        
        // Check if app path exists
        try {
          await fs.access(appPath);
        } catch {
          return {
            content: [{ 
              type: "text", 
              text: `Application path does not exist: ${appPath}` 
            }],
            isError: true,
          };
        }
        
        const electronArgs = [appPath, ...appArgs];
        if (devMode) {
          electronArgs.push("--dev");
        }
        
        electronProcess = spawn("electron", electronArgs, {
          stdio: ["ignore", "pipe", "pipe"],
          cwd: path.dirname(appPath),
        });
        
        electronProcess.on("error", (error) => {
          console.error("Electron process error:", error);
        });
        
        electronProcess.on("exit", (code) => {
          console.error(`Electron process exited with code ${code}`);
          electronProcess = null;
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `Successfully launched Electron application from ${appPath}${devMode ? " in development mode" : ""}. PID: ${electronProcess.pid}` 
          }],
        };
      }

      case ToolName.CLOSE_ELECTRON_APP: {
        const { force } = CloseElectronAppSchema.parse(args);
        
        if (!electronProcess) {
          return {
            content: [{ 
              type: "text", 
              text: "No Electron application is currently running." 
            }],
          };
        }
        
        if (force) {
          electronProcess.kill("SIGKILL");
        } else {
          electronProcess.kill("SIGTERM");
        }
        
        electronProcess = null;
        
        return {
          content: [{ 
            type: "text", 
            text: `Successfully ${force ? "force " : ""}closed Electron application.` 
          }],
        };
      }

      case ToolName.GET_ELECTRON_INFO: {
        GetElectronInfoSchema.parse(args);
        
        const electronInstalled = await checkElectronInstalled();
        if (!electronInstalled) {
          return {
            content: [{ 
              type: "text", 
              text: "Electron is not installed on this system." 
            }],
          };
        }
        
        try {
          const { execSync } = await import("child_process");
          const version = execSync("electron --version", { encoding: "utf-8" }).trim();
          
          return {
            content: [{ 
              type: "text", 
              text: `Electron Information:
- Version: ${version}
- Platform: ${process.platform}
- Architecture: ${process.arch}
- Node.js: ${process.version}
- Installed: Yes` 
            }],
          };
        } catch (error) {
          return {
            content: [{ 
              type: "text", 
              text: `Error getting Electron information: ${error}` 
            }],
            isError: true,
          };
        }
      }

      case ToolName.CREATE_ELECTRON_PROJECT: {
        const { projectName, projectPath, template } = CreateElectronProjectSchema.parse(args);
        
        const fullProjectPath = path.join(projectPath, projectName);
        
        // Check if directory already exists
        try {
          await fs.access(fullProjectPath);
          return {
            content: [{ 
              type: "text", 
              text: `Project directory already exists: ${fullProjectPath}` 
            }],
            isError: true,
          };
        } catch {
          // Directory doesn't exist, which is what we want
        }
        
        switch (template) {
          case "basic":
            await createBasicElectronProject(fullProjectPath, projectName);
            break;
          default:
            return {
              content: [{ 
                type: "text", 
                text: `Template "${template}" is not yet implemented. Only "basic" template is currently supported.` 
              }],
              isError: true,
            };
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Successfully created Electron project "${projectName}" at ${fullProjectPath}

Next steps:
1. cd ${fullProjectPath}
2. npm install
3. npm start

Project structure:
- main.js (main process)
- index.html (renderer)
- package.json (configuration)` 
          }],
        };
      }

      case ToolName.BUILD_ELECTRON_APP: {
        const { projectPath, platform, arch, debug } = BuildElectronAppSchema.parse(args);
        
        // Check if project path exists
        try {
          await fs.access(projectPath);
        } catch {
          return {
            content: [{ 
              type: "text", 
              text: `Project path does not exist: ${projectPath}` 
            }],
            isError: true,
          };
        }
        
        // This is a simplified build process - in a real implementation,
        // you would use electron-builder or electron-packager
        return {
          content: [{ 
            type: "text", 
            text: `Build functionality is not yet fully implemented.

To build your Electron app manually:
1. Install electron-builder: npm install electron-builder --save-dev
2. Add build script to package.json
3. Run: npm run build

Target platform: ${platform || "current"}
Target architecture: ${arch || "current"}
Debug mode: ${debug}` 
          }],
        };
      }

      case ToolName.GET_ELECTRON_PROCESS_INFO: {
        GetElectronProcessInfoSchema.parse(args);
        
        if (!electronProcess) {
          return {
            content: [{ 
              type: "text", 
              text: "No Electron application is currently running." 
            }],
          };
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Electron Process Information:
- PID: ${electronProcess.pid}
- Status: Running
- Platform: ${process.platform}
- Started: ${new Date().toISOString()}` 
          }],
        };
      }

      case ToolName.SEND_COMMAND_TO_ELECTRON: {
        const { command, args: commandArgs } = SendCommandToElectronSchema.parse(args);
        
        if (!electronProcess) {
          return {
            content: [{ 
              type: "text", 
              text: "No Electron application is currently running to send commands to." 
            }],
            isError: true,
          };
        }
        
        // This is a placeholder for sending commands to Electron
        // In a real implementation, you would need IPC communication
        return {
          content: [{ 
            type: "text", 
            text: `Command sending functionality is not yet fully implemented.

Command: ${command}
Arguments: ${JSON.stringify(commandArgs)}

To implement this feature, you would need to set up IPC communication
between the MCP server and the Electron application.` 
          }],
        };
      }

      default:
        return {
          content: [{ 
            type: "text", 
            text: `Unknown tool: ${name}` 
          }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ 
        type: "text", 
        text: `Error executing ${name}: ${errorMessage}` 
      }],
      isError: true,
    };
  }
});

// Clean up on exit
process.on("SIGINT", () => {
  if (electronProcess) {
    electronProcess.kill("SIGTERM");
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (electronProcess) {
    electronProcess.kill("SIGTERM");
  }
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Electron MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
