# Electron MCP Server

[![GitHub license](https://img.shields.io/github/license/halilural/electron-mcp-server)](https://github.com/halilural/electron-mcp-server/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/electron-mcp-server)](https://www.npmjs.com/package/electron-mcp-server)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue)](https://modelcontextprotocol.io)

A Model Context Protocol (MCP) server that provides comprehensive Electron application management and automation capabilities. This server enables AI assistants and LLMs to interact with Electron applications through a standardized interface.

## 🚀 Features

- **Application Lifecycle Management**: Launch, close, and monitor Electron applications
- **Project Scaffolding**: Create new Electron projects with customizable templates
- **Build System Integration**: Build applications for multiple platforms and architectures
- **Process Management**: Monitor and control running Electron processes
- **Development Tools**: Support for development mode with debugging features
- **Cross-Platform Support**: Works on Windows, macOS, and Linux

## 📦 Installation

### Global Installation

```bash
npm install -g electron-mcp-server
```

### Local Installation

```bash
npm install electron-mcp-server
```

## 🛠️ Usage

### With VS Code

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=electron&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22electron-mcp-server%22%5D%7D)

For manual installation, add the following to your VS Code MCP settings:

```json
{
  "mcp": {
    "servers": {
      "electron": {
        "command": "npx",
        "args": ["-y", "electron-mcp-server"]
      }
    }
  }
}
```

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "electron": {
      "command": "npx",
      "args": ["-y", "electron-mcp-server"]
    }
  }
}
```

### Direct Usage

```bash
# Run the server directly
npx electron-mcp-server

# Or if installed globally
electron-mcp-server
```

## 🔧 Available Tools

### `launch_electron_app`

Launch an Electron application from a specified path.

**Parameters:**

- `appPath` (string): Path to the Electron application
- `args` (array, optional): Additional command line arguments
- `devMode` (boolean, optional): Launch in development mode with debugging

**Example:**

```javascript
{
  "appPath": "/path/to/my-electron-app",
  "devMode": true,
  "args": ["--enable-logging"]
}
```

### `close_electron_app`

Close the currently running Electron application.

**Parameters:**

- `force` (boolean, optional): Force close the application if unresponsive

### `get_electron_info`

Get information about the Electron installation and environment.

**Returns:**

- Electron version
- Platform information
- Node.js version
- Installation status

### `create_electron_project`

Create a new Electron project with a basic structure.

**Parameters:**

- `projectName` (string): Name of the new project
- `projectPath` (string): Directory where to create the project
- `template` (string, optional): Project template ("basic", "react", "vue", "angular")

**Example:**

```javascript
{
  "projectName": "my-awesome-app",
  "projectPath": "/Users/username/Projects",
  "template": "basic"
}
```

### `build_electron_app`

Build an Electron application for distribution.

**Parameters:**

- `projectPath` (string): Path to the Electron project
- `platform` (string, optional): Target platform ("win32", "darwin", "linux")
- `arch` (string, optional): Target architecture ("x64", "arm64", "ia32")
- `debug` (boolean, optional): Build in debug mode

### `get_electron_process_info`

Get information about the currently running Electron process.

**Returns:**

- Process ID (PID)
- Status
- Platform
- Start time

### `send_command_to_electron`

Send commands to the running Electron application (requires IPC setup).

**Parameters:**

- `command` (string): Command to send
- `args` (any, optional): Command arguments

## 🏗️ Project Templates

### Basic Template

The basic template creates a minimal Electron application with:

- Main process (`main.js`)
- Renderer process (`index.html`)
- Basic window management
- Development mode support

### Coming Soon

- **React Template**: Electron + React setup
- **Vue Template**: Electron + Vue.js setup
- **Angular Template**: Electron + Angular setup

## 🧪 Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Electron (for testing)

### Setup

```bash
# Clone the repository
git clone https://github.com/halilural/electron-mcp-server.git
cd electron-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📝 API Reference

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) specification and provides tools for Electron application management.

### Error Handling

All tools return standardized error responses when operations fail:

- Missing dependencies (Electron not installed)
- Invalid paths or parameters
- Process management errors
- Build system failures

### Security Considerations

- The server only operates on explicitly provided paths
- Process management is limited to applications launched through the server
- Build operations require valid project structures

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io) for the standardized interface
- [Electron](https://electronjs.org) for the desktop application framework
- The open source community for inspiration and contributions

## 🔗 Links

- [GitHub Repository](https://github.com/halilural/electron-mcp-server)
- [NPM Package](https://www.npmjs.com/package/electron-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Electron Documentation](https://electronjs.org/docs)

---

**Note**: This MCP server is designed to work with MCP-compatible clients like Claude Desktop, VS Code with MCP support, and other AI assistants that implement the Model Context Protocol.
