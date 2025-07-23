import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import WebSocket from "ws";

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

// Helper function to get window information from any running Electron app
export async function getElectronWindowInfo(
  includeChildren: boolean = false
): Promise<any> {
  try {
    console.log("[MCP] Scanning for running Electron applications...");
    
    // Try to connect to Chrome DevTools Protocol on common debugging ports
    const commonPorts = [9222, 9223, 9224, 9225];
    let targetInfo = null;
    let connectedPort = null;
    
    for (const port of commonPorts) {
      try {
        console.log(`[MCP] Trying to connect to port ${port}...`);
        const response = await fetch(`http://localhost:${port}/json`, {
          signal: AbortSignal.timeout(1000) // 1 second timeout
        });
        
        if (response.ok) {
          const targets = await response.json();
          console.log(`[MCP] Found ${targets.length} targets on port ${port}`);
          
          const electronTargets = targets.filter((target: any) => 
            target.type === 'page' && 
            (target.url.startsWith('file://') || 
             target.url.startsWith('http://localhost') ||
             target.url.startsWith('https://') ||
             target.title.includes('Electron'))
          );
          
          if (electronTargets.length > 0) {
            targetInfo = {
              port,
              targets: targets,
              electronTargets,
              allTargets: includeChildren ? targets : electronTargets
            };
            connectedPort = port;
            console.log(`[MCP] Successfully connected to Electron app on port ${port}`);
            break;
          }
        }
      } catch (error) {
        // Silently continue to next port
        console.log(`[MCP] Port ${port} not available: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (targetInfo) {
      // Get additional process information
      const execAsync = promisify(exec);
      let processInfo = {};
      
      try {
        const { stdout } = await execAsync(
          "ps aux | grep -i electron | grep -v grep | grep -v 'Visual Studio Code'"
        );
        
        const electronProcesses = stdout
          .trim()
          .split("\n")
          .filter((line) => line.includes("electron"))
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              cpu: parts[2],
              memory: parts[3],
              command: parts.slice(10).join(" ")
            };
          });
          
        processInfo = { electronProcesses };
      } catch (error) {
        console.log("[MCP] Could not get process info:", error);
      }
      
      return {
        platform: process.platform,
        devToolsPort: connectedPort,
        windows: targetInfo.allTargets.map((target: any) => ({
          id: target.id,
          title: target.title,
          url: target.url,
          type: target.type,
          description: target.description,
          webSocketDebuggerUrl: target.webSocketDebuggerUrl
        })),
        totalTargets: targetInfo.targets.length,
        electronTargets: targetInfo.electronTargets.length,
        processInfo,
        message: `Found running Electron application with ${targetInfo.electronTargets.length} windows on port ${connectedPort}`,
        automationReady: true
      };
    } else {
      // No DevTools connection found, try fallback process detection
      console.log("[MCP] No DevTools connection found, checking for Electron processes...");
      
      const execAsync = promisify(exec);
      try {
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
            message: "No Electron applications are currently running",
            automationReady: false,
            suggestion: "Start your Electron app with remote debugging enabled using: electron . --remote-debugging-port=9222"
          };
        }

        return {
          platform: process.platform,
          windows: [],
          electronProcesses: electronProcesses.map((line) => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              cpu: parts[2],
              memory: parts[3],
              command: parts.slice(10).join(" ")
            };
          }),
          message: `Found ${electronProcesses.length} Electron processes but no remote debugging connection available`,
          automationReady: false,
          suggestion: "Restart your Electron app with: electron . --remote-debugging-port=9222"
        };
      } catch (error) {
        return {
          platform: process.platform,
          windows: [],
          message: "No Electron applications are currently running",
          automationReady: false,
          suggestion: "Start your Electron app with remote debugging enabled using: electron . --remote-debugging-port=9222"
        };
      }
    }
  } catch (error) {
    return {
      platform: process.platform,
      windows: [],
      error: `Failed to scan for Electron applications: ${error instanceof Error ? error.message : String(error)}`,
      automationReady: false
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
  let electronCmd: string = '';
  let electronArgs: string[] = [];
  let workingDir: string;
  let useNpmScript = false;
  
  if (isDirectory) {
    workingDir = appPath;
    
    // Intelligent project type detection
    const packageJsonPath = path.join(workingDir, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const scripts = packageJson.scripts || {};
        const devDependencies = packageJson.devDependencies || {};
        const dependencies = packageJson.dependencies || {};
        
        console.log("[MCP] Analyzing project type...");
        
        // Check for Electron + Vite (like Infinitome)
        if (devDependencies['electron-vite'] || devDependencies['vite']) {
          console.log("[MCP] Detected Electron + Vite project");
          if (scripts.dev) {
            console.log("[MCP] Using npm run dev for Electron + Vite project");
            electronCmd = 'npm';
            electronArgs = ['run', 'dev'];
            useNpmScript = true;
          }
        }
        // Check for Electron + Webpack (electron-builder, electron-webpack, etc.)
        else if (devDependencies['electron-webpack'] || devDependencies['webpack']) {
          console.log("[MCP] Detected Electron + Webpack project");
          if (scripts.dev) {
            electronCmd = 'npm';
            electronArgs = ['run', 'dev'];
            useNpmScript = true;
          } else if (scripts.start) {
            electronCmd = 'npm';
            electronArgs = ['run', 'start'];
            useNpmScript = true;
          }
        }
        // Check for Create React App + Electron
        else if (devDependencies['react-scripts'] || dependencies['react-scripts']) {
          console.log("[MCP] Detected React + Electron project");
          if (scripts.start) {
            electronCmd = 'npm';
            electronArgs = ['run', 'start'];
            useNpmScript = true;
          }
        }
        // Check for Next.js + Electron
        else if (devDependencies['next'] || dependencies['next']) {
          console.log("[MCP] Detected Next.js + Electron project");
          if (scripts.dev) {
            electronCmd = 'npm';
            electronArgs = ['run', 'dev'];
            useNpmScript = true;
          }
        }
        
        // If we're using npm script and in devMode, the script should handle debugging
        if (useNpmScript && devMode) {
          console.log("[MCP] Development mode enabled - npm script will handle Electron debugging");
        }
      } catch (error) {
        console.log("[MCP] Could not parse package.json, falling back to direct Electron launch");
      }
    }
    
    // Fallback to direct Electron launch if no npm script detected
    if (!useNpmScript) {
      const localElectronPath = path.join(workingDir, 'node_modules', '.bin', 'electron');
      electronCmd = localElectronPath;
      electronArgs = ['.', ...args];
      console.log("[MCP] Using direct Electron binary launch");
      
      if (devMode) {
        electronArgs.push("--dev");
        electronArgs.push("--remote-debugging-port=9222");
      }
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
  console.log(`[MCP DEBUG] Using npm script: ${useNpmScript}`);

  try {
    // Create clean environment
    const cleanEnv = { ...process.env };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    
    // For npm scripts, we need to ensure debugging is enabled
    if (useNpmScript && devMode) {
      cleanEnv.ELECTRON_ENABLE_LOGGING = 'true';
      cleanEnv.ELECTRON_REMOTE_DEBUGGING_PORT = '9222';
    }
    
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

export async function sendCommandToElectron(
  command: string,
  args?: any
): Promise<string> {
  try {
    console.log("[MCP] Looking for running Electron applications...");
    
    // Try to connect to Chrome DevTools Protocol on common debugging ports
    const commonPorts = [9222, 9223, 9224, 9225];
    let targetInfo = null;
    let connectedPort = null;
    
    for (const port of commonPorts) {
      try {
        const response = await fetch(`http://localhost:${port}/json`, {
          signal: AbortSignal.timeout(1000)
        });
        
        if (response.ok) {
          const targets = await response.json();
          const mainTarget = targets.find((target: any) => 
            target.type === 'page' && !target.title.includes('DevTools')
          ) || targets.find((target: any) => target.type === 'page');
          
          if (mainTarget) {
            targetInfo = mainTarget;
            connectedPort = port;
            console.log(`[MCP] Found Electron app on port ${port}: ${mainTarget.title}`);
            break;
          }
        }
      } catch (error) {
        // Continue to next port
      }
    }
    
    if (!targetInfo) {
      throw new Error("No running Electron application found with remote debugging enabled. Start your app with: electron . --remote-debugging-port=9222");
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

    // Use WebSocket to execute commands via Chrome DevTools Protocol
    const wsUrl = targetInfo.webSocketDebuggerUrl;
    if (!wsUrl) {
      throw new Error("No WebSocket debugger URL available");
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const messageId = Math.floor(Math.random() * 1000000);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Command execution timeout (10s)"));
      }, 10000);

      ws.on('open', () => {
        console.log(`[MCP] Connected to ${targetInfo.title} via WebSocket`);
        
        // Enable Runtime domain first
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.enable'
        }));
        
        // Send Runtime.evaluate command
        const message = {
          id: messageId,
          method: 'Runtime.evaluate',
          params: {
            expression: javascriptCode,
            returnByValue: true,
            awaitPromise: false
          }
        };
        
        console.log(`[MCP] Executing: ${javascriptCode}`);
        ws.send(JSON.stringify(message));
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.id === messageId) {
            clearTimeout(timeout);
            ws.close();
            
            if (response.error) {
              reject(new Error(`DevTools Protocol error: ${response.error.message}`));
            } else if (response.result) {
              const result = response.result.result;
              if (result.type === 'string') {
                resolve(`✅ Command executed: ${result.value}`);
              } else if (result.type === 'undefined') {
                resolve(`✅ Command executed successfully`);
              } else {
                resolve(`✅ Result: ${JSON.stringify(result.value, null, 2)}`);
              }
            } else {
              resolve(`✅ Command sent successfully`);
            }
          }
        } catch (error) {
          console.error(`[MCP] Failed to parse response:`, error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });
    });
    
  } catch (error) {
    throw new Error(`Failed to send command: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readElectronLogs(
  logType: 'console' | 'main' | 'renderer' | 'all' = 'all',
  lines: number = 100,
  follow: boolean = false
): Promise<string> {
  try {
    console.log("[MCP] Looking for running Electron applications for log access...");
    
    // Try to connect to Chrome DevTools Protocol on common debugging ports
    const commonPorts = [9222, 9223, 9224, 9225];
    let targetInfo = null;
    let connectedPort = null;
    
    for (const port of commonPorts) {
      try {
        const response = await fetch(`http://localhost:${port}/json`, {
          signal: AbortSignal.timeout(1000)
        });
        
        if (response.ok) {
          const targets = await response.json();
          const mainTarget = targets.find((target: any) => 
            target.type === 'page' && !target.title.includes('DevTools')
          ) || targets.find((target: any) => target.type === 'page');
          
          if (mainTarget) {
            targetInfo = mainTarget;
            connectedPort = port;
            console.log(`[MCP] Found Electron app on port ${port} for log access: ${mainTarget.title}`);
            break;
          }
        }
      } catch (error) {
        // Continue to next port
      }
    }
    
    if (!targetInfo) {
      // Fallback to system logs if DevTools not available
      console.log("[MCP] No DevTools connection found, checking system logs...");
      return await getSystemElectronLogs(logType, lines);
    }

    // Connect via WebSocket to get console logs
    if (logType === 'console' || logType === 'all') {
      const wsUrl = targetInfo.webSocketDebuggerUrl;
      if (wsUrl) {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(wsUrl);
          const logs: string[] = [];
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve(logs.join('\n') || 'No console logs available');
          }, 5000);

          ws.on('open', () => {
            console.log(`[MCP] Connected for log access to: ${targetInfo.title}`);
            
            // Enable Runtime and Console domains
            ws.send(JSON.stringify({
              id: 1,
              method: 'Runtime.enable'
            }));
            
            ws.send(JSON.stringify({
              id: 2,
              method: 'Console.enable'
            }));
            
            // Get existing logs
            ws.send(JSON.stringify({
              id: 3,
              method: 'Runtime.evaluate',
              params: {
                expression: `console.log('MCP Log Reader Connected at ${new Date().toISOString()}'); 'Connected'`,
                returnByValue: true
              }
            }));
          });

          ws.on('message', (data) => {
            try {
              const response = JSON.parse(data.toString());
              
              if (response.method === 'Console.messageAdded') {
                const msg = response.params.message;
                const timestamp = new Date().toISOString();
                logs.push(`[${timestamp}] ${msg.level.toUpperCase()}: ${msg.text}`);
                
                if (logs.length >= lines) {
                  clearTimeout(timeout);
                  ws.close();
                  resolve(logs.slice(-lines).join('\n'));
                }
              } else if (response.method === 'Runtime.consoleAPICalled') {
                const call = response.params;
                const timestamp = new Date().toISOString();
                const args = call.args?.map((arg: any) => arg.value || arg.description).join(' ') || '';
                logs.push(`[${timestamp}] ${call.type.toUpperCase()}: ${args}`);
                
                if (logs.length >= lines) {
                  clearTimeout(timeout);
                  ws.close();
                  resolve(logs.slice(-lines).join('\n'));
                }
              }
            } catch (error) {
              console.error(`[MCP] Failed to parse log message:`, error);
            }
          });

          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`WebSocket error: ${error.message}`));
          });
        });
      }
    }
    
    // Fallback to system logs
    return await getSystemElectronLogs(logType, lines);
    
  } catch (error) {
    throw new Error(`Failed to read logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getSystemElectronLogs(
  logType: 'console' | 'main' | 'renderer' | 'all' = 'all',
  lines: number = 100
): Promise<string> {
  console.log("[MCP] Reading system logs for Electron processes...");
  
  try {
    // Get running Electron processes
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('ps aux | grep -i electron | grep -v grep');
    const electronProcesses = stdout.trim().split('\n').filter(line => line.length > 0);
    
    if (electronProcesses.length === 0) {
      return "No Electron processes found running on the system.";
    }
    
    let logOutput = `Found ${electronProcesses.length} Electron process(es):\n\n`;
    
    electronProcesses.forEach((process, index) => {
      const parts = process.trim().split(/\s+/);
      const pid = parts[1];
      const command = parts.slice(10).join(' ');
      logOutput += `Process ${index + 1}:\n`;
      logOutput += `  PID: ${pid}\n`;
      logOutput += `  Command: ${command}\n\n`;
    });
    
    // Try to read console.log output from system logs
    try {
      const { stdout: logContent } = await execAsync(`log show --last 1h --predicate 'process == "Electron"' --style compact | tail -${lines}`);
      if (logContent.trim()) {
        logOutput += "Recent Electron logs from system:\n";
        logOutput += "==========================================\n";
        logOutput += logContent;
      } else {
        logOutput += "No recent Electron logs found in system logs. Try enabling remote debugging with --remote-debugging-port=9222 for better log access.";
      }
    } catch (logError) {
      logOutput += "Could not access system logs. For detailed logging, start Electron app with --remote-debugging-port=9222";
    }
    
    return logOutput;
    
  } catch (error) {
    return `Error reading system logs: ${error instanceof Error ? error.message : String(error)}`;
  }
}
