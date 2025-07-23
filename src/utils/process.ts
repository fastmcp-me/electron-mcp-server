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
  const execAsync = promisify(exec);

  // If no Electron process is managed by this server, try to find any running Electron processes
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

      // Get the first Electron process that's not VS Code
      const processInfo = electronProcesses[0];
      const pid = processInfo.split(/\s+/)[1];

      // Try to get window info for this process
      if (process.platform === "darwin") {
        const script = `
          tell application "System Events"
            set targetProcess to (first process whose unix id is ${pid})
            set windowInfo to {}
            try
              set appWindows to every window of targetProcess
              repeat with appWindow in appWindows
                set winName to name of appWindow
                set winPos to position of appWindow
                set winSize to size of appWindow
                set windowInfo to windowInfo & {winName & ", " & (item 1 of winPos) & ", " & (item 2 of winPos) & ", " & (item 1 of winSize) & ", " & (item 2 of winSize)}
              end repeat
            end try
            return windowInfo as string
          end tell
        `;
        const { stdout: windowInfo } = await execAsync(
          `osascript -e '${script}'`
        );
        return {
          platform: "darwin",
          windows: windowInfo.trim(),
          message:
            "Found running Electron app (not managed by this MCP server)",
          externalProcess: true,
          pid: pid,
        };
      }
    } catch (error) {
      return {
        platform: process.platform,
        windows: [],
        message: "No Electron application is currently running",
      };
    }
  }

  try {
    if (process.platform === "darwin") {
      // macOS: Get window information for the specific process ID
      const pid = electronProcess?.pid;
      if (!pid) {
        throw new Error("No valid process ID");
      }
      const script = `
        tell application "System Events"
          set targetProcess to (first process whose unix id is ${pid})
          set windowInfo to {}
          try
            set appWindows to every window of targetProcess
            repeat with appWindow in appWindows
              set winName to name of appWindow
              set winPos to position of appWindow
              set winSize to size of appWindow
              set windowInfo to windowInfo & {winName & ", " & (item 1 of winPos) & ", " & (item 2 of winPos) & ", " & (item 1 of winSize) & ", " & (item 2 of winSize)}
            end repeat
          end try
          return windowInfo as string
        end tell
      `;
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return { platform: "darwin", windows: stdout.trim() };
    } else if (process.platform === "win32") {
      // Windows: Get window information for the specific process ID
      const pid = electronProcess?.pid;
      if (!pid) {
        throw new Error("No valid process ID");
      }
      const script = `
        Get-Process -Id ${pid} | Where-Object {$_.MainWindowHandle -ne 0} | 
        ForEach-Object {
          @{
            ProcessName = $_.ProcessName
            MainWindowTitle = $_.MainWindowTitle
            Id = $_.Id
            WindowHandle = $_.MainWindowHandle
          }
        } | ConvertTo-Json
      `;
      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      return { platform: "win32", windows: JSON.parse(stdout || "[]") };
    } else {
      // Unsupported platform
      return {
        platform: process.platform,
        windows: [],
        error: "Platform not supported",
      };
    }
  } catch (error) {
    return {
      platform: process.platform,
      windows: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
    // Send command via stdin to the Electron process
    const commandData = JSON.stringify({
      command,
      args,
      timestamp: Date.now(),
    });
    electronProcess.stdin?.write(commandData + "\n");

    return `Command sent to Electron process: ${command}`;
  } catch (error) {
    throw new Error(`Failed to send command to Electron: ${error}`);
  }
}
