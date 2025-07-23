const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const os = require("os");

// Note: Remote debugging port is set via command line arguments when launched in dev mode

// Enable live reload for development
if (process.argv.includes("--dev")) {
  try {
    require("electron-reload")(__dirname, {
      electron: path.join(__dirname, "..", "node_modules", ".bin", "electron"),
      hardResetMethod: "exit",
    });
  } catch (e) {
    console.log("electron-reload not found, continuing without live reload");
  }
}

let mainWindow;
let logMessages = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    titleBarStyle: "default",
    icon: path.join(__dirname, "assets", "icon.png"), // Will create this later
  });

  mainWindow.loadFile("index.html");

  // Open DevTools in development
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Log console messages from renderer
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      const logEntry = `[RENDERER-${level}] ${message}`;
      logMessages.push(logEntry);
      console.log(logEntry);

      // Keep only last 1000 log messages
      if (logMessages.length > 1000) {
        logMessages = logMessages.slice(-1000);
      }
    }
  );

  // Log when window is ready
  mainWindow.webContents.once("did-finish-load", () => {
    const logEntry = "[MAIN] Window loaded successfully";
    logMessages.push(logEntry);
    console.log(logEntry);
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createWindow(),
        },
        {
          label: "Show Logs",
          accelerator: "CmdOrCtrl+L",
          click: () => showLogsWindow(),
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: "Example Electron App",
              detail:
                "This is an example Electron application for testing MCP server tools.\\n\\nFeatures:\\n- MCP command handling\\n- Log collection\\n- System information\\n- Window management",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function showLogsWindow() {
  const logWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const logHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Application Logs</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .log-entry { margin: 2px 0; padding: 2px 5px; border-radius: 3px; }
        .log-main { background: #2d3142; }
        .log-renderer-0 { background: #1a3d3d; } /* verbose */
        .log-renderer-1 { background: #3d3d1a; } /* info */
        .log-renderer-2 { background: #3d1a1a; } /* warning */
        .log-renderer-3 { background: #4d1a1a; } /* error */
        .header { color: #569cd6; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h2 class="header">Application Logs (${logMessages.length} entries)</h2>
      <div id="logs">
        ${logMessages
          .map((log) => {
            const className = log.startsWith("[MAIN]")
              ? "log-main"
              : log.includes("-0]")
              ? "log-renderer-0"
              : log.includes("-1]")
              ? "log-renderer-1"
              : log.includes("-2]")
              ? "log-renderer-2"
              : "log-renderer-3";
            return `<div class="log-entry ${className}">${log}</div>`;
          })
          .join("")}
      </div>
      <script>
        // Auto-scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        
        // Auto-refresh every 2 seconds
        setInterval(() => {
          window.location.reload();
        }, 2000);
      </script>
    </body>
    </html>
  `;

  logWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(logHtml)
  );
}

app.whenReady().then(() => {
  createWindow();

  const logEntry = "[MAIN] Application started";
  logMessages.push(logEntry);
  console.log(logEntry);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for MCP communication
ipcMain.handle("mcp-command", async (event, command, args) => {
  const logEntry = `[IPC] MCP Command received: ${command}`;
  logMessages.push(logEntry);
  console.log(logEntry, args);

  const response = {
    success: true,
    command,
    args,
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    versions: process.versions,
  };

  return response;
});

ipcMain.handle("get-system-info", async () => {
  const info = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
  };

  const logEntry = "[IPC] System info requested";
  logMessages.push(logEntry);
  console.log(logEntry);

  return info;
});

ipcMain.handle("get-logs", async () => {
  const logEntry = "[IPC] Logs requested";
  logMessages.push(logEntry);
  console.log(logEntry);

  return logMessages;
});

ipcMain.handle("clear-logs", async () => {
  logMessages = [];
  const logEntry = "[IPC] Logs cleared";
  logMessages.push(logEntry);
  console.log(logEntry);

  return { success: true };
});

ipcMain.on("toggle-devtools", () => {
  if (mainWindow) {
    mainWindow.webContents.toggleDevTools();
  }
});

// Log process events
process.on("uncaughtException", (error) => {
  const logEntry = `[MAIN-ERROR] Uncaught exception: ${error.message}`;
  logMessages.push(logEntry);
  console.error(logEntry, error);
});

process.on("unhandledRejection", (reason, promise) => {
  const logEntry = `[MAIN-ERROR] Unhandled rejection: ${reason}`;
  logMessages.push(logEntry);
  console.error(logEntry, promise);
});
