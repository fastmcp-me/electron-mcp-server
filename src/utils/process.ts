import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";
import * as path from "path";

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
  
  try {
    if (process.platform === "darwin") {
      // macOS: Use osascript to get window information
      const script = `
        tell application "System Events"
          set electronApps to every process whose name contains "Electron"
          set windowInfo to {}
          repeat with electronApp in electronApps
            try
              set appWindows to every window of electronApp
              repeat with appWindow in appWindows
                set windowInfo to windowInfo & {name of appWindow, position of appWindow, size of appWindow}
              end repeat
            end try
          end repeat
          return windowInfo
        end tell
      `;
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return { platform: "darwin", windows: stdout.trim() };
    } else if (process.platform === "win32") {
      // Windows: Use PowerShell to get window information
      const script = `
        Get-Process | Where-Object {$_.ProcessName -like "*electron*" -and $_.MainWindowHandle -ne 0} | 
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
      return { platform: process.platform, windows: [], error: "Platform not supported" };
    }
  } catch (error) {
    return { 
      platform: process.platform, 
      windows: [], 
      error: error instanceof Error ? error.message : String(error) 
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

  const electronArgs = [appPath, ...args];
  
  if (devMode) {
    electronArgs.push("--dev");
    electronArgs.push("--remote-debugging-port=9222");
  }

  try {
    electronProcess = spawn("electron", electronArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.dirname(appPath),
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

    return `Electron application launched successfully. PID: ${electronProcess.pid}`;
  } catch (error) {
    electronProcess = null;
    throw new Error(`Failed to launch Electron app: ${error}`);
  }
}

export async function closeElectronApp(force: boolean = false): Promise<string> {
  if (!electronProcess) {
    throw new Error("No Electron process is currently running");
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
    const commandData = JSON.stringify({ command, args, timestamp: Date.now() });
    electronProcess.stdin?.write(commandData + "\n");
    
    return `Command sent to Electron process: ${command}`;
  } catch (error) {
    throw new Error(`Failed to send command to Electron: ${error}`);
  }
}
