# Windows CLI MCP Server

MCP server for secure command-line interactions on Windows systems, enabling controlled access to PowerShell, CMD, and Git Bash shells. It enables MCP clients (like [Claude Desktop](https://claude.ai/download)) to perform operations on your system, similar to [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter).

> ⚠️ **WARNING**: This MCP server provides direct access to your system's command line interface. When enabled, it grants access to your files, environment variables, and command execution capabilities.
>
> Always:
>
> - Review and restrict allowed paths
> - Enable directory restrictions
> - Configure command blocks
> - Consider security implications
>
> See [Configuration](#configuration) for more details.

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

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "windows-cli": {
      "command": "npx",
      "args": ["-y", "@simonb97/server-win-cli"]
    }
  }
}
```

For use with a specific config file, add the `--config` flag:

```json
"args": ["-y", "@simonb97/server-win-cli", "--config", "path/to/your/config.json"]
```

## Configuration

The server uses a JSON configuration file to customize its behavior. You can specify settings for security controls and shell configurations.

To create a default config file, copy `config.json.example` to `config.json`, or run:

```bash
npx @simonb97/server-win-cli --init-config ./config.json
```

Then set the `--config` flag to point to your config file.

### Configuration Locations

The server looks for configuration in the following locations (in order):

1. Path specified by `--config` flag
2. ./config.json in current directory
3. ~/.win-cli-mcp/config.json in user's home directory

If no configuration file is found, the server will use a default (restricted) configuration.

### Default Configuration

If no configuration file is found, the server uses the following default settings:

```json
{
  "security": {
    "maxCommandLength": 2000,
    "blockedCommands": [
      "rm",
      "del",
      "rmdir",
      "format",
      "shutdown",
      "restart",
      "reg",
      "regedit",
      "net",
      "netsh",
      "takeown",
      "icacls"
    ],
    "allowedPaths": ["User's home directory", "Current working directory"],
    "restrictWorkingDirectory": true,
    "logCommands": true,
    "maxHistorySize": 1000,
    "commandTimeout": 30
  },
  "shells": {
    "powershell": {
      "enabled": true,
      "command": "powershell.exe",
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
    "maxHistorySize": 1000,

    // Timeout for command execution in seconds (default: 30)
    "commandTimeout": 30
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

## API

### Tools

- **execute_command**

  - Execute a command in the specified shell
  - Inputs:
    - `shell` (string): Shell to use ("powershell", "cmd", or "gitbash")
    - `command` (string): Command to execute
    - `workingDir` (optional string): Working directory
  - Returns command output as text, or error message if execution fails

- **get_command_history**
  - Get the history of executed commands
  - Input: `limit` (optional number)
  - Returns timestamped command history with outputs

## Security Considerations

- Commands containing blocked terms are rejected
- Working directories are validated against allowed paths
- Command length is limited by default
- Shell processes are properly terminated
- All inputs are validated before execution
- Environment variables and personal files may be accessible within allowed paths
- Consider limiting access to sensitive directories and environment information

## Troubleshooting

- Ensure the config.json path is correct in your Claude Desktop configuration
- Verify that the specified shells are available on your system
- Check that the allowed paths exist and are accessible
- Review the command history for any failed operations
- Ensure proper permissions for accessing specified directories

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
