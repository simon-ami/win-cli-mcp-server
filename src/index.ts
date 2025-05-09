#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { 
  isCommandBlocked,
  isArgumentBlocked,
  parseCommand,
  extractCommandName,
  validateShellOperators,
  normalizeWindowsPath,
  validateWorkingDirectory
} from './utils/validation.js';
import { validateDirectoriesAndThrow } from './utils/directoryValidator.js';
import { spawn } from 'child_process';
import { z } from 'zod';
import { readFileSync } from 'fs';
import path from 'path';
import { buildToolDescription } from './utils/toolDescription.js';
import { loadConfig, createDefaultConfig } from './utils/config.js';
import { createSerializableConfig } from './utils/configUtils.js';
import type { ServerConfig } from './types/config.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// Parse command line arguments using yargs
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

const parseArgs = async () => {
  return yargs(hideBin(process.argv))
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to config file'
    })
    .option('init-config', {
      type: 'string',
      description: 'Create a default config file at the specified path'
    })
    .help()
    .parse();
};

const ValidateDirectoriesArgsSchema = z.object({
  directories: z.array(z.string()),
});

class CLIServer {
  private server: Server;
  private allowedPaths: Set<string>;
  private blockedCommands: Set<string>;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server({
      name: "windows-cli-server",
      version: packageJson.version,
    }, {
      capabilities: {
        tools: {},
        resources: {}  // Add resources capability
      }
    });

    // Initialize from config
    this.allowedPaths = new Set(config.security.allowedPaths);
    this.blockedCommands = new Set(config.security.blockedCommands);

    this.setupHandlers();
  }

  private validateCommand(shell: keyof ServerConfig['shells'], command: string): void {
    // Check for command chaining/injection attempts if enabled
    if (this.config.security.enableInjectionProtection) {
      // Get shell-specific config
      const shellConfig = this.config.shells[shell];
      
      // Use shell-specific operator validation
      validateShellOperators(command, shellConfig);
    }
  
    const { command: executable, args } = parseCommand(command);
  
    // Check for blocked commands
    if (isCommandBlocked(executable, Array.from(this.blockedCommands))) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Command is blocked: "${extractCommandName(executable)}"`
      );
    }
  
    // Check for blocked arguments
    if (isArgumentBlocked(args, this.config.security.blockedArguments)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'One or more arguments are blocked. Check configuration for blocked patterns.'
      );
    }
  
    // Validate command length
    if (command.length > this.config.security.maxCommandLength) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Command exceeds maximum length of ${this.config.security.maxCommandLength}`
      );
    }
  }

  /**
   * Escapes special characters in a string for use in a regular expression
   * @param text The string to escape
   * @returns The escaped string
   */
  private escapeRegex(text: string): string {
    return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }
  
  /**
   * Creates a structured copy of the configuration for external use
   * @returns A serializable version of the configuration
   */
  private getSafeConfig(): any {
    return createSerializableConfig(this.config);
  }

  private setupHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources: Array<{uri:string,name:string,description:string,mimeType:string}> = [];
      
      // Add a resource for CLI configuration
      resources.push({
        uri: "cli://config",
        name: "CLI Server Configuration",
        description: "Main CLI server configuration (excluding sensitive data)",
        mimeType: "application/json"
      });

      return { resources };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      // Handle CLI configuration resource
      if (uri === "cli://config") {
        // Create a structured copy of config for external use
        const safeConfig = this.getSafeConfig();
        
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(safeConfig, null, 2)
          }]
        };
      }
      
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown resource URI: ${uri}`
      );
    });

    // List available tools: log execute_command description then return tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allowedShells = (Object.keys(this.config.shells) as Array<keyof typeof this.config.shells>)
        .filter(shell => this.config.shells[shell].enabled);
      const descriptionLines = [
        ...buildToolDescription(allowedShells)
      ];
      const description = descriptionLines.join("\n");
      console.error(`[tool: execute_command] Description:\n${description}`);
      const tools = [
        {
          name: "execute_command",
          description,
          inputSchema: {
            type: "object",
            properties: {
              shell: { type: "string", enum: allowedShells, description: "Shell to use for command execution" },
              command: { type: "string", description: "Command to execute" },
              workingDir: { type: "string", description: "Working directory (optional)" }
            },
            required: ["shell", "command"]
          }
        },
        {
          name: "get_current_directory",
          description: "Get the current working directory",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "set_current_directory",
          description: "Set the current working directory",
          inputSchema: { 
            type: "object", 
            properties: { 
              path: { type: "string", description: "Path to set as current working directory" } 
            },
            required: ["path"]
          }
        },
        {
          name: "get_config",
          description: "Get the windows CLI server configuration",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "validate_directories",
          description: "Check if directories are within allowed paths (only available when restrictWorkingDirectory is enabled)",
          inputSchema: {
            type: "object",
            properties: {
              directories: { type: "array", items: { type: "string" }, description: "List of directories to validate" }
            },
            required: ["directories"]
          }
        }
      ];
      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "execute_command": {
            // parse args with allowed shells
            const args = z.object({
              shell: z.enum(Object.keys(this.config.shells).filter(shell => 
                this.config.shells[shell as keyof typeof this.config.shells].enabled
              ) as [string, ...string[]]),
              command: z.string(),
              workingDir: z.string().optional()
            }).parse(request.params.arguments);

            // Validate command
            this.validateCommand(args.shell as keyof ServerConfig['shells'], args.command);

            // Validate working directory if provided
            let workingDir = args.workingDir ? normalizeWindowsPath(args.workingDir) : process.cwd();

            const shellKey = args.shell as keyof typeof this.config.shells;
            const shellConfig = this.config.shells[shellKey];
            
            if (this.config.security.restrictWorkingDirectory) {
              try {
                // Use the normalized path for validation
                validateWorkingDirectory(workingDir, Array.from(this.allowedPaths));
              } catch (error) {
                let originalWorkingDir = args.workingDir ? args.workingDir : process.cwd();
                throw new McpError(
                  ErrorCode.InvalidRequest,
                  `Working directory (${originalWorkingDir}) outside allowed paths. Use validate_directories tool to validate directories before execution.`
                );
              }
            }

            // Execute command
            return new Promise((resolve, reject) => {
              let shellProcess: ReturnType<typeof spawn>;
              
              try {
                shellProcess = spawn(
                  shellConfig.command,
                  [...shellConfig.args, args.command],
                  { cwd: workingDir, stdio: ['pipe', 'pipe', 'pipe'] }
                );
              } catch (err) {
                throw new McpError(
                  ErrorCode.InternalError,
                  `Failed to start shell process: ${err instanceof Error ? err.message : String(err)}. Consult the server admin for configuration changes (config.json - shells).`
                );
              }

              if (!shellProcess.stdout || !shellProcess.stderr) {
                throw new McpError(
                  ErrorCode.InternalError,
                  'Failed to initialize shell process streams'
                );
              }

              let output = '';
              let error = '';

              shellProcess.stdout.on('data', (data) => {
                output += data.toString();
              });

              shellProcess.stderr.on('data', (data) => {
                error += data.toString();
              });

              shellProcess.on('close', (code) => {
                // Prepare detailed result message
                let resultMessage = '';
                
                if (code === 0) {
                  resultMessage = output || 'Command completed successfully (no output)';
                } else {
                  resultMessage = `Command failed with exit code ${code}\n`;
                  if (error) {
                    resultMessage += `Error output:\n${error}\n`;
                  }
                  if (output) {
                    resultMessage += `Standard output:\n${output}`;
                  }
                  if (!error && !output) {
                    resultMessage += 'No error message or output was provided';
                  }
                }

                resolve({
                  content: [{
                    type: "text",
                    text: resultMessage
                  }],
                  isError: code !== 0,
                  metadata: {
                    exitCode: code ?? -1,
                    shell: args.shell,
                    workingDirectory: workingDir
                  }
                });
              });

              // Handle process errors (e.g., shell crashes)
              shellProcess.on('error', (err) => {
                const errorMessage = `Shell process error: ${err.message}`;
                reject(new McpError(
                  ErrorCode.InternalError,
                  errorMessage
                ));
              });

              // Set configurable timeout to prevent hanging
              const timeout = setTimeout(() => {
                shellProcess.kill();
                const timeoutMessage = `Command execution timed out after ${this.config.security.commandTimeout} seconds. Consult the server admin for configuration changes (config.json - commandTimeout).`;
                reject(new McpError(
                  ErrorCode.InternalError,
                  timeoutMessage
                ));
              }, this.config.security.commandTimeout * 1000);

              shellProcess.on('close', () => clearTimeout(timeout));
            });
          }

          case "get_current_directory": {
            const currentDir = process.cwd();
            return {
              content: [{
                type: "text",
                text: currentDir
              }],
              isError: false,
              metadata: {}
            };
          }
          
          case "set_current_directory": {
            // Parse args
            const args = z.object({
              path: z.string()
            }).parse(request.params.arguments);
            
            // Normalize the path
            const newDir = normalizeWindowsPath(args.path);
            
            // Validate the path
            try {
              if (this.config.security.restrictWorkingDirectory) {
                validateWorkingDirectory(newDir, Array.from(this.allowedPaths));
              }
              
              // Change directory
              process.chdir(newDir);
              
              const currentDir = process.cwd();
              return {
                content: [{
                  type: "text",
                  text: `Current directory changed to: ${currentDir}`
                }],
                isError: false,
                metadata: {
                  previousDirectory: args.path,
                  newDirectory: currentDir
                }
              };
            } catch (error) {
              return {
                content: [{
                  type: "text",
                  text: `Failed to change directory: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true,
                metadata: {
                  requestedDirectory: args.path
                }
              };
            }
          }

          case "validate_directories": {
            if (!this.config.security.restrictWorkingDirectory) {
              return {
                content: [{
                  type: "text",
                  text: "Directory validation is disabled because 'restrictWorkingDirectory' is not enabled in the server configuration."
                }],
                isError: true,
                metadata: {}
              };
            }
            try {
              const parsedValDirArgs = ValidateDirectoriesArgsSchema.parse(request.params.arguments);
              const allowedPathsArray = this.config.security.allowedPaths ?? [];
              validateDirectoriesAndThrow(parsedValDirArgs.directories, allowedPathsArray);
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({ message: "All specified directories are valid and within allowed paths." })
                }],
                isError: false,
                metadata: {}
              };
            } catch (error: any) {
              if (error instanceof z.ZodError) {
                return {
                  content: [{
                    type: "text",
                    text: `Invalid arguments for validate_directories: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`
                  }],
                  isError: true,
                  metadata: {}
                };
              } else if (error instanceof McpError) {
                return {
                  content: [{
                    type: "text",
                    text: error.message
                  }],
                  isError: true,
                  metadata: {}
                };
              } else {
                return {
                  content: [{
                    type: "text",
                    text: `An unexpected error occurred during directory validation: ${error.message || String(error)}`
                  }],
                  isError: true,
                  metadata: {}
                };
              }
            }
          }

          case "get_config": {
            // Create a structured copy of config for external use
            const safeConfig = this.getSafeConfig();
            return {
              content: [{
                type: "text",
                text: JSON.stringify(safeConfig, null, 2)
              }],
              isError: false,
              metadata: {}
            };
          }

          default:
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments: ${err.errors.map(e => e.message).join(', ')}`
          );
        }
        throw err;
      }
    });
  }

  private async cleanup(): Promise<void> {
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    
    // Set up cleanup handler
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
    
    await this.server.connect(transport);
    console.error("Windows CLI MCP Server running on stdio");
  }
}

// Start server
const main = async () => {
  try {
    const args = await parseArgs();
    
    // Handle --init-config flag
    if (args['init-config']) {
      try {
        createDefaultConfig(args['init-config'] as string);
        console.error(`Created default config at: ${args['init-config']}`);
        process.exit(0);
      } catch (error) {
        console.error('Failed to create config file:', error);
        process.exit(1);
      }
    }

    // Load configuration
    const config = loadConfig(args.config);
    
    const server = new CLIServer(config);
    await server.run();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
};

main();