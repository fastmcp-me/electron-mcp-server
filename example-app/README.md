# Example Electron App for MCP Testing

This example Electron application demonstrates and tests the MCP (Model Context Protocol) server tools for Electron automation.

## Features

- **Beautiful UI**: Modern glass-morphism design with interactive cards
- **MCP Integration**: Direct communication with the MCP server
- **System Information**: Real-time system and process monitoring
- **Developer Tools**: Built-in DevTools toggle and app management
- **Logging System**: Comprehensive logging with real-time display
- **Testing Features**: Error simulation and performance testing
- **Window Management**: Minimize, maximize, and center controls

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start the app**:
   ```bash
   npm start
   ```

## UI Overview

### 🔗 MCP Communication

- **Test MCP**: Tests connection to the MCP server
- **Custom Command**: Send custom MCP commands with arguments

### 🖥️ System Information

- **Get System Info**: Display detailed system information
- **Process Info**: Show current process details

### 🛠️ Developer Tools

- **Toggle DevTools**: Open/close Electron DevTools
- **Reload App**: Refresh the application
- **New Window**: Create additional windows
- Real-time uptime and memory usage stats

### 📋 Application Logs

- **Show Logs**: Display application logs from the main process
- **Clear Logs**: Remove all stored logs
- **Generate Test Logs**: Create sample log entries

### 🧪 Testing Features

- **Simulate Error**: Generate test errors for debugging
- **Performance Test**: Run performance benchmarks
- **Memory Test**: Test memory allocation and usage

### 🪟 Window Management

- **Minimize/Maximize/Center**: Basic window controls

## MCP Testing

The app includes built-in MCP communication features:

1. **Start the MCP server** (from the root directory):

   ```bash
   npm start
   ```

2. **Launch the example app** (from this directory):

   ```bash
   npm start
   ```

3. **Test MCP tools**:
   - Use the "Test MCP" button in the UI
   - Send custom commands with JSON arguments
   - Monitor system information and logs

## Available MCP Commands

The app can test these MCP server tools:

- `launch_electron_app` - Launch Electron applications
- `get_running_electron_apps` - List running Electron apps
- `kill_electron_app` - Terminate Electron processes
- `take_screenshot` - Capture screen screenshots
- `get_app_logs` - Retrieve application logs
- `read_log_file` - Read specific log files
- `get_window_info` - Get window information
- `focus_window` - Focus specific windows
- `create_electron_project` - Create new Electron projects
- `get_system_info` - Get system information

## Logging

The app maintains a comprehensive logging system:

- **Circular Buffer**: Stores up to 1000 log entries
- **Real-time Display**: Shows logs in the UI instantly
- **Multiple Levels**: Info, warning, error, and success messages
- **Timestamped**: All logs include precise timestamps
- **IPC Integration**: Logs are shared between main and renderer processes

## Development

### Building

```bash
npm run build
```

### Packaging

```bash
npm run dist
```

## Architecture

- **Main Process** (`main.js`): Handles system operations, logging, and MCP communication
- **Renderer Process** (`index.html`): Provides the user interface and interaction
- **IPC Communication**: Secure communication between processes using Electron's IPC

## Troubleshooting

### Common Issues

1. **MCP Connection Failed**: Ensure the MCP server is running on stdio
2. **No Logs Showing**: Check that the main process logging is enabled
3. **UI Not Responsive**: Try toggling DevTools to check for errors

### Debug Mode

Open DevTools (`Ctrl+Shift+I` or use the UI button) to see detailed console logs and debug information.

## Integration with MCP Server

This example app is designed to work seamlessly with the parent MCP server. It demonstrates:

- How Electron apps can be launched via MCP tools
- System information retrieval and monitoring
- Screenshot capabilities
- Log file reading and management
- Window information and control
- Process management and automation

Perfect for testing and demonstrating the full capabilities of the Electron MCP server!
