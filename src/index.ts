#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from 'child_process';
import { z } from 'zod';
import path from 'path';
import os from 'os';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadConfig, createDefaultConfig } from './utils/config.js';

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
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
  .argv;

// Handle --init-config flag
if (argv['init-config']) {
  try {
    createDefaultConfig(argv['init-config'] as string);
    console.error(`Created default config at: ${argv['init-config']}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create config file:', error);
    process.exit(1);
  }
}

// Load configuration
const config = loadConfig(argv.config as string | undefined);

class CLIServer {
  private server: Server;
  private allowedPaths: Set<string>;
  private blockedCommands: Set<string>;
  private commandHistory: Array<{ command: string; output: string; timestamp: string }>;

  constructor() {
    this.server = new Server({
      name: "windows-cli-server",
      version: "0.1.0",
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Initialize from config
    this.allowedPaths = new Set(config.security.allowedPaths);
    this.blockedCommands = new Set(config.security.blockedCommands);
    this.commandHistory = [];

    this.setupHandlers();
  }

  private validateCommand(command: string): void {
    // Check for blocked commands
    for (const blockedCmd of this.blockedCommands) {
      if (command.toLowerCase().includes(blockedCmd.toLowerCase())) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Command contains blocked term: ${blockedCmd}`
        );
      }
    }

    // Validate command length
    if (command.length > config.security.maxCommandLength) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Command exceeds maximum length of ${config.security.maxCommandLength}`
      );
    }
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "execute_command",
          description: "Execute a command in the specified shell (powershell, cmd, or gitbash)",
          inputSchema: {
            type: "object",
            properties: {
              shell: {
                type: "string",
                enum: Object.keys(config.shells).filter(shell => config.shells[shell as keyof typeof config.shells].enabled),
                description: "Shell to use for command execution"
              },
              command: {
                type: "string",
                description: "Command to execute"
              },
              workingDir: {
                type: "string",
                description: "Working directory for command execution (optional)"
              }
            },
            required: ["shell", "command"]
          }
        },
        {
          name: "get_command_history",
          description: "Get the history of executed commands",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: `Maximum number of history entries to return (default: 10, max: ${config.security.maxHistorySize})`
              }
            }
          }
        }
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "execute_command": {
            const args = z.object({
              shell: z.enum(Object.keys(config.shells).filter(shell => 
                config.shells[shell as keyof typeof config.shells].enabled
              ) as [string, ...string[]]),
              command: z.string(),
              workingDir: z.string().optional()
            }).parse(request.params.arguments);

            // Validate command
            this.validateCommand(args.command);

            // Validate working directory if provided
            let workingDir = args.workingDir ? 
              path.resolve(args.workingDir) : 
              process.cwd();

            const shellConfig = config.shells[args.shell];
            
            if (config.security.restrictWorkingDirectory) {
              const isAllowedPath = Array.from(this.allowedPaths).some(
                allowedPath => workingDir.startsWith(allowedPath)
              );

              if (!isAllowedPath) {
                throw new McpError(
                  ErrorCode.InvalidRequest,
                  'Working directory outside allowed paths'
                );
              }
            }

            // Execute command
            return new Promise((resolve, reject) => {
              const shellProcess = spawn(
                shellConfig.command,
                [...shellConfig.args, args.command],
                { cwd: workingDir }
              );

              let output = '';
              let error = '';

              shellProcess.stdout.on('data', (data) => {
                output += data.toString();
              });

              shellProcess.stderr.on('data', (data) => {
                error += data.toString();
              });

              shellProcess.on('close', (code) => {
                const result = output || error;
                
                // Store in history
                if (config.security.logCommands) {
                  this.commandHistory.push({
                    command: args.command,
                    output: result,
                    timestamp: new Date().toISOString()
                  });

                  // Trim history if needed
                  if (this.commandHistory.length > config.security.maxHistorySize) {
                    this.commandHistory = this.commandHistory.slice(-config.security.maxHistorySize);
                  }
                }

                if (code === 0) {
                  resolve({
                    content: [{
                      type: "text",
                      text: result
                    }]
                  });
                } else {
                  resolve({
                    content: [{
                      type: "text",
                      text: `Command failed with code ${code}:\n${result}`
                    }],
                    isError: true
                  });
                }
              });

              shellProcess.on('error', (err) => {
                reject(new McpError(
                  ErrorCode.InternalError,
                  `Failed to execute command: ${err.message}`
                ));
              });
            });
          }

          case "get_command_history": {
            if (!config.security.logCommands) {
              return {
                content: [{
                  type: "text",
                  text: "Command history is disabled in configuration"
                }]
              };
            }

            const args = z.object({
              limit: z.number()
                .min(1)
                .max(config.security.maxHistorySize)
                .optional()
                .default(10)
            }).parse(request.params.arguments);

            const history = this.commandHistory
              .slice(-args.limit)
              .map(entry => ({
                ...entry,
                output: entry.output.slice(0, 1000) // Limit output size
              }));

            return {
              content: [{
                type: "text",
                text: JSON.stringify(history, null, 2)
              }]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments: ${error.errors.map(e => e.message).join(', ')}`
          );
        }
        throw error;
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Windows CLI MCP Server running on stdio");
    if (argv.config) {
      console.error(`Using config file: ${argv.config}`);
    }
  }
}

// Start server
const server = new CLIServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});