# Windows CLI MCP Server

MCP server for secure command-line interactions on Windows systems, enabling controlled access to PowerShell, CMD, and Git Bash shells.

> ⚠️ **WARNING**: This MCP server provides direct access to your system's command line interface. When enabled, it grants access to:
>
> - Your personal files and directories
> - System environment variables (which may contain sensitive information)
> - Command execution capabilities that could modify your system
> - Local development environments and tools
>
> Always:
>
> - Review and restrict the `allowedPaths` configuration
> - Enable strict directory restrictions
> - Configure appropriate command blocks
> - Be aware of what system access you're granting
> - Consider the security implications of your configuration choices

## Features

- **Multi-Shell Support**: Execute commands in PowerShell, Command Prompt (CMD), and Git Bash
- **Security Controls**:
  - Command validation and filtering
  - Working directory validation
  - Maximum command length limits
  - Command logging and history tracking
- **Configurable**:
  - Custom security rules
  - Shell-specific settings
  - Path restrictions
  - Blocked command lists

**Note**: The server will only allow operations within configured directories and with allowed commands.

## API

### Resources

None (this server provides tools only)

### Tools

- **execute_command**

  - Execute a command in the specified shell
  - Inputs:
    - `shell` (string): Shell to use ("powershell", "cmd", or "gitbash")
    - `command` (string): Command to execute
    - `workingDir` (optional string): Working directory

- **get_command_history**
  - Get the history of executed commands
  - Input: `limit` (optional number)
  - Returns timestamped command history with outputs

## Configuration

The server uses a JSON configuration file to customize its behavior. You can specify settings for security controls and shell configurations.

### Basic Setup

1. Create a default config:

```bash
node dist/index.js --init-config ./my-config.json
```

2. Default config locations (searched in order):
   - Path specified by `--config` flag
   - ./config.json in current directory
   - ~/.win-cli-mcp/config.json in user's home directory

### Configuration Settings

The configuration file is divided into two main sections: `security` and `shells`.

#### Security Settings

```json
{
  "security": {
    // Maximum allowed length for any command
    "maxCommandLength": 1000,

    // Commands that contain any of these strings will be blocked
    "blockedCommands": [
      // Suggested defaults
      "rm", // Delete files
      "del", // Delete files
      "rmdir", // Delete directories
      "format", // Format disks
      "shutdown", // Shutdown system
      "restart", // Restart system
      "reg", // Registry editor
      "regedit", // Registry editor
      "net", // Network commands
      "netsh", // Network commands
      "takeown", // Take ownership of files
      "icacls" // Change file permissions
    ],

    // List of directories where commands can be executed
    "allowedPaths": ["C:\\Users\\YourUsername", "C:\\Projects"],

    // If true, commands can only run in allowedPaths
    "restrictWorkingDirectory": true,

    // If true, saves command history
    "logCommands": true,

    // Maximum number of commands to keep in history
    "maxHistorySize": 1000
  }
}
```

#### Shell Configuration

```json
{
  "shells": {
    "powershell": {
      // Enable/disable this shell
      "enabled": true,
      // Path to shell executable
      "command": "powershell.exe",
      // Default arguments for the shell
      "args": ["-NoProfile", "-NonInteractive", "-Command"]
    },
    "cmd": {
      "enabled": true,
      "command": "cmd.exe",
      "args": ["/c"]
    },
    "gitbash": {
      "enabled": true,
      "command": "C:\\Program Files\\Git\\bin\\bash.exe",
      "args": ["-c"]
    }
  }
}
```

### Example Configurations

1. Minimal Security Configuration:

```json
{
  "security": {
    "maxCommandLength": 2000,
    "blockedCommands": ["rm", "format", "shutdown"],
    "allowedPaths": ["C:\\Users\\YourUsername"],
    "restrictWorkingDirectory": false,
    "logCommands": true,
    "maxHistorySize": 100
  }
}
```

2. PowerShell-Only Configuration:

```json
{
  "shells": {
    "powershell": {
      "enabled": true,
      "command": "powershell.exe",
      "args": ["-NoProfile", "-NonInteractive", "-Command"]
    },
    "cmd": {
      "enabled": false
    },
    "gitbash": {
      "enabled": false
    }
  }
}
```

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "windows-cli": {
      "command": "node",
      // Config flag and path are optional
      "args": ["path/to/dist/index.js", "--config", "path/to/your/config.json"]
    }
  }
}
```

## Security Considerations

- Commands containing blocked terms are rejected
- Working directories are validated against allowed paths
- Command length is limited to prevent abuse
- Shell processes are properly terminated
- Command history length is configurable
- All inputs are validated before execution
- Environment variables and personal files may be accessible within allowed paths
- Consider limiting access to sensitive directories and environment information
- Review and test security settings before deployment

## Installation

1. Ensure prerequisites:

   - Node.js 18 or higher
   - npm or yarn
   - Windows with PowerShell and CMD
   - Git Bash (optional, for Git Bash support)

2. Install dependencies:

```bash
npm install
```

3. Build the server:

```bash
npm run build
```

## Development

1. Clone the repository:

```bash
git clone <repository-url>
cd win-cli-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Build in watch mode:

```bash
npm run watch
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
