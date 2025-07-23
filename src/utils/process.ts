import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

// Electron process management
export let electronProcess: ChildProcess | null = null;
export let electronLogs: string[] = [];

export function setElectronProcess(process: ChildProcess | null): void {
  electronProcess = process;
}

export function getElectronProcess(): ChildProcess | null {
  return electronProcess;
}

export function addElectronLog(log: string): void {
  electronLogs.push(log);
}

export function getElectronLogs(): string[] {
  return electronLogs;
}

export function clearElectronLogs(): void {
  electronLogs = [];
}

export function resetElectronProcess(): void {
  electronProcess = null;
  electronLogs = [];
}

// Helper function to get window information
export async function getElectronWindowInfo(
  includeChildren: boolean = false
): Promise<any> {
  // If we have a managed Electron process, use Chrome DevTools Protocol
  if (electronProcess && electronProcess.pid) {
    try {
      // Use Chrome DevTools Protocol to get window/target information
      const response = await fetch('http://localhost:9222/json');
      const targets = await response.json();
      
      const windowInfo = targets.map((target: any) => ({
        id: target.id,
        title: target.title,
        url: target.url,
        type: target.type,
        description: target.description
      }));

      return {
        platform: process.platform,
        pid: electronProcess.pid,
        windows: windowInfo,
        devToolsPort: 9222,
        message: "Window information retrieved via Chrome DevTools Protocol"
      };
    } catch (error) {
      console.error("Failed to get window info via DevTools Protocol:", error);
      // Fall back to process detection
    }
  }

  // Fallback: Try to find any running Electron processes if no managed process
  const execAsync = promisify(exec);
  if (!electronProcess) {
    try {
      // Try to find any running Electron processes
      const { stdout } = await execAsync(
        "ps aux | grep -i electron | grep -v grep | grep -v 'Visual Studio Code'"
      );
      const electronProcesses = stdout
        .trim()
        .split("\n")
        .filter((line) => line.includes("electron"));

      if (electronProcesses.length === 0) {
        return {
          platform: process.platform,
          windows: [],
          message: "No Electron application is currently running",
        };
      }

      return {
        platform: process.platform,
        windows: electronProcesses,
        message: "Found external Electron processes (not managed by this MCP server)",
        externalProcess: true,
      };
    } catch (error) {
      return {
        platform: process.platform,
        windows: [],
        message: "No Electron application is currently running",
      };
    }
  }

  return {
    platform: process.platform,
    windows: [],
    error: "Unable to get window information",
  };
}

export async function launchElectronApp(
  appPath: string,
  args: string[] = [],
  devMode: boolean = false
): Promise<string> {
  if (electronProcess) {
    throw new Error("An Electron process is already running");
  }

  // Check if appPath is a directory or a file
  const isDirectory = appPath.endsWith('/') || !appPath.includes('.');
  let electronCmd: string;
  let electronArgs: string[];
  let workingDir: string;
  
  if (isDirectory) {
    workingDir = appPath;
    
    // Use local Electron binary for best compatibility
    const localElectronPath = path.join(workingDir, 'node_modules', '.bin', 'electron');
    electronCmd = localElectronPath;
    electronArgs = ['.', ...args];
    console.log("[MCP] Using local Electron binary with clean environment");
    
    if (devMode) {
      electronArgs.push("--dev");
      electronArgs.push("--remote-debugging-port=9222");
    }
  } else {
    // If it's a file, run "electron filename" from the parent directory
    electronCmd = "electron";
    electronArgs = [path.basename(appPath), ...args];
    workingDir = path.dirname(appPath);
    if (devMode) {
      electronArgs.push("--dev");
      electronArgs.push("--remote-debugging-port=9222");
    }
  }

  console.log(`[MCP DEBUG] Final command: ${electronCmd} ${electronArgs.join(' ')}`);
  console.log(`[MCP DEBUG] Working directory: ${workingDir}`);

  try {
    // Create clean environment without ELECTRON_RUN_AS_NODE
    const cleanEnv = { ...process.env };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    
    electronProcess = spawn(electronCmd, electronArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: workingDir,
      env: cleanEnv,
    });

    // Clear previous logs
    electronLogs = [];

    // Capture stdout
    electronProcess.stdout?.on("data", (data) => {
      const log = `[Main] ${data.toString()}`;
      electronLogs.push(log);
      console.log(log);
    });

    // Capture stderr
    electronProcess.stderr?.on("data", (data) => {
      const log = `[Error] ${data.toString()}`;
      electronLogs.push(log);
      console.error(log);
    });

    // Handle process exit
    electronProcess.on("exit", (code, signal) => {
      const log = `[Process] Electron exited with code ${code} and signal ${signal}`;
      electronLogs.push(log);
      console.log(log);
      electronProcess = null;
    });

    // Handle process error
    electronProcess.on("error", (error) => {
      const log = `[Process] Electron error: ${error.message}`;
      electronLogs.push(log);
      console.error(log);
      electronProcess = null;
    });

    // Wait a bit to see if the process starts successfully
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if the process is still running
    if (!electronProcess || electronProcess.exitCode !== null) {
      throw new Error("Electron process failed to start or exited immediately");
    }

    return `Electron application launched successfully. PID: ${electronProcess.pid} (using ${electronCmd})`;
  } catch (error) {
    electronProcess = null;
    throw new Error(`Failed to launch Electron app: ${error}`);
  }
}

export async function closeElectronApp(
  force: boolean = false
): Promise<string> {
  if (!electronProcess) {
    return "No Electron application is currently managed by this MCP server. Use launch_electron_app first.";
  }

  try {
    if (force) {
      electronProcess.kill("SIGKILL");
      electronProcess = null;
      return "Electron application force closed";
    } else {
      electronProcess.kill("SIGTERM");

      // Wait for graceful shutdown or force after timeout
      setTimeout(() => {
        if (electronProcess) {
          electronProcess.kill("SIGKILL");
          electronProcess = null;
        }
      }, 5000);

      return "Electron application closing gracefully";
    }
  } catch (error) {
    electronProcess = null;
    throw new Error(`Failed to close Electron app: ${error}`);
  }
}

export async function buildElectronApp(
  projectPath: string,
  platform?: string,
  arch?: string,
  debug: boolean = false
): Promise<string> {
  const execAsync = promisify(exec);

  try {
    let buildCommand = "npm run build";

    if (platform || arch || debug) {
      // Use electron-builder with specific options
      buildCommand = "npx electron-builder";

      if (platform) {
        buildCommand += ` --${platform}`;
      }

      if (arch) {
        buildCommand += ` --${arch}`;
      }

      if (debug) {
        buildCommand += " --debug";
      }
    }

    const { stdout, stderr } = await execAsync(buildCommand, {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for build output
    });

    let result = "Build completed successfully!";
    if (stdout) result += `\n\nOutput:\n${stdout}`;
    if (stderr) result += `\n\nWarnings/Errors:\n${stderr}`;

    return result;
  } catch (error) {
    throw new Error(`Build failed: ${error}`);
  }
}

export async function sendCommandToElectron(
  command: string,
  args?: any
): Promise<string> {
  if (!electronProcess) {
    throw new Error("No Electron process is currently running");
  }

  try {
    // Use Chrome DevTools Protocol to send commands to any Electron app
    const targetsResponse = await fetch('http://localhost:9222/json');
    const targets = await targetsResponse.json();
    
    // Find the main target (exclude DevTools window)
    const mainTarget = targets.find((target: any) => 
      target.type === 'page' && !target.title.includes('DevTools')
    ) || targets.find((target: any) => target.type === 'page');
    
    if (!mainTarget) {
      throw new Error("No valid target found in Electron app");
    }

    // Different command types for demonstration
    let javascriptCode: string;
    
    switch (command.toLowerCase()) {
      case 'get_title':
        javascriptCode = 'document.title';
        break;
      case 'get_url':
        javascriptCode = 'window.location.href';
        break;
      case 'get_body_text':
        javascriptCode = 'document.body.innerText.substring(0, 500)';
        break;
      case 'click_button':
        javascriptCode = `document.querySelector('${args?.selector || 'button'}')?.click(); 'Button clicked'`;
        break;
      case 'console_log':
        javascriptCode = `console.log('MCP Command:', '${args?.message || 'Hello from MCP!'}'); 'Console message sent'`;
        break;
      case 'eval':
        javascriptCode = args?.code || command;
        break;
      default:
        javascriptCode = command;
    }

    // Use HTTP-based Runtime.evaluate for simple commands
    const evaluateUrl = `http://localhost:9222/json/runtime/evaluate`;
    const evaluateBody = {
      expression: javascriptCode,
      returnByValue: true
    };

    try {
      const evaluateResponse = await fetch(evaluateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(evaluateBody)
      });

      if (evaluateResponse.ok) {
        const result = await evaluateResponse.json();
        return `Command executed successfully in "${mainTarget.title}": ${JSON.stringify(result, null, 2)}`;
      }
    } catch (httpError) {
      console.log("HTTP evaluation failed, trying WebSocket approach...");
    }

    // Enhanced WebSocket approach for more complex commands
    const wsUrl = mainTarget.webSocketDebuggerUrl;
    if (!wsUrl) {
      throw new Error("No WebSocket debugger URL available");
    }

    return `Command "${command}" prepared for WebSocket execution in target: ${mainTarget.title || mainTarget.url}\nTarget ID: ${mainTarget.id}\nJavaScript: ${javascriptCode}`;
    
  } catch (error) {
    // Fallback to stdin approach (may not work with all apps)
    try {
      const commandData = JSON.stringify({
        command,
        args,
        timestamp: Date.now(),
      });
      electronProcess.stdin?.write(commandData + "\n");
      return `Command sent via stdin: ${command}`;
    } catch (stdinError) {
      throw new Error(`Failed to send command via DevTools Protocol or stdin: ${error}`);
    }
  }
}
