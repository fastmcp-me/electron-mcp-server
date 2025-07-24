import WebSocket from "ws";
import { scanForElectronApps, findMainTarget } from "./electron-discovery.js";

export interface DevToolsTarget {
  id: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  type: string;
}

export interface CommandResult {
  success: boolean;
  result?: any;
  error?: string;
  message: string;
}

/**
 * Find and connect to a running Electron application
 */
export async function findElectronTarget(): Promise<DevToolsTarget> {
  console.log("[MCP] Looking for running Electron applications...");

  const foundApps = await scanForElectronApps();
  
  if (foundApps.length === 0) {
    throw new Error(
      "No running Electron application found with remote debugging enabled. Start your app with: electron . --remote-debugging-port=9222"
    );
  }

  const app = foundApps[0];
  const mainTarget = findMainTarget(app.targets);

  if (!mainTarget) {
    throw new Error("No suitable target found in Electron application");
  }

  console.log(
    `[MCP] Found Electron app on port ${app.port}: ${mainTarget.title}`
  );

  return {
    id: mainTarget.id,
    title: mainTarget.title,
    url: mainTarget.url,
    webSocketDebuggerUrl: mainTarget.webSocketDebuggerUrl,
    type: mainTarget.type,
  };
}

/**
 * Execute JavaScript code in an Electron application via Chrome DevTools Protocol
 */
export async function executeInElectron(
  javascriptCode: string,
  target?: DevToolsTarget
): Promise<string> {
  const targetInfo = target || await findElectronTarget();

  if (!targetInfo.webSocketDebuggerUrl) {
    throw new Error("No WebSocket debugger URL available");
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(targetInfo.webSocketDebuggerUrl);
    const messageId = Math.floor(Math.random() * 1000000);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Command execution timeout (10s)"));
    }, 10000);

    ws.on("open", () => {
      console.log(`[MCP] Connected to ${targetInfo.title} via WebSocket`);

      // Enable Runtime domain first
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.enable",
        })
      );

      // Send Runtime.evaluate command
      const message = {
        id: messageId,
        method: "Runtime.evaluate",
        params: {
          expression: javascriptCode,
          returnByValue: true,
          awaitPromise: false,
        },
      };

      console.log(`[MCP] Executing JavaScript code...`);
      ws.send(JSON.stringify(message));
    });

    ws.on("message", (data) => {
      try {
        const response = JSON.parse(data.toString());

        if (response.id === messageId) {
          clearTimeout(timeout);
          ws.close();

          if (response.error) {
            reject(
              new Error(`DevTools Protocol error: ${response.error.message}`)
            );
          } else if (response.result) {
            const result = response.result.result;
            if (result.type === "string") {
              resolve(`✅ Command executed: ${result.value}`);
            } else if (result.type === "undefined") {
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

    ws.on("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${error.message}`));
    });
  });
}

/**
 * Connect to Electron app for real-time log monitoring
 */
export async function connectForLogs(
  target?: DevToolsTarget,
  onLog?: (log: string) => void
): Promise<WebSocket> {
  const targetInfo = target || await findElectronTarget();
  
  if (!targetInfo.webSocketDebuggerUrl) {
    throw new Error("No WebSocket debugger URL available for log connection");
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(targetInfo.webSocketDebuggerUrl);
    
    ws.on("open", () => {
      console.log(`[MCP] Connected for log monitoring to: ${targetInfo.title}`);

      // Enable Runtime and Console domains
      ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      ws.send(JSON.stringify({ id: 2, method: "Console.enable" }));

      resolve(ws);
    });

    ws.on("message", (data) => {
      try {
        const response = JSON.parse(data.toString());

        if (response.method === "Console.messageAdded") {
          const msg = response.params.message;
          const timestamp = new Date().toISOString();
          const logEntry = `[${timestamp}] ${msg.level.toUpperCase()}: ${msg.text}`;
          onLog?.(logEntry);
        } else if (response.method === "Runtime.consoleAPICalled") {
          const call = response.params;
          const timestamp = new Date().toISOString();
          const args = call.args?.map((arg: any) => arg.value || arg.description).join(" ") || "";
          const logEntry = `[${timestamp}] ${call.type.toUpperCase()}: ${args}`;
          onLog?.(logEntry);
        }
      } catch (error) {
        console.error(`[MCP] Failed to parse log message:`, error);
      }
    });

    ws.on("error", (error) => {
      reject(new Error(`WebSocket error: ${error.message}`));
    });
  });
}
