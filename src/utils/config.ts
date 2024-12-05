import fs from 'fs';
import path from 'path';
import os from 'os';
import { ServerConfig, ShellConfig } from '../types/config.js';

const defaultValidatePathRegex = /^[a-zA-Z]:\\(?:[^<>:"/\\|?*]+\\)*[^<>:"/\\|?*]*$/;

export const DEFAULT_CONFIG: ServerConfig = {
  security: {
    maxCommandLength: 2000,
    blockedCommands: [
      'rm', 'del', 'rmdir', 'format',
      'shutdown', 'restart',
      'reg', 'regedit',
      'net', 'netsh',
      'takeown', 'icacls'
    ],
    blockedArguments: [
      "--exec", "-e", "/c", "-enc", "-encodedcommand",
      "-command", "--interactive", "-i", "--login", "--system"
    ],
    allowedPaths: [
      os.homedir(),
      process.cwd()
    ],
    restrictWorkingDirectory: true,
    logCommands: true,
    maxHistorySize: 1000,
    commandTimeout: 30,
    enableInjectionProtection: true
  },
  shells: {
    powershell: {
      enabled: true,
      command: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command'],
      validatePath: (dir: string) => dir.match(defaultValidatePathRegex) !== null
    },
    cmd: {
      enabled: true,
      command: 'cmd.exe',
      args: ['/c'],
      validatePath: (dir: string) => dir.match(defaultValidatePathRegex) !== null
    },
    gitbash: {
      enabled: true,
      command: 'C:\\Program Files\\Git\\bin\\bash.exe',
      args: ['-c'],
      validatePath: (dir: string) => dir.match(defaultValidatePathRegex) !== null
    }
  },
  ssh: {
    enabled: false,
    defaultTimeout: 30,
    maxConcurrentSessions: 5,
    keepaliveInterval: 10000,
    readyTimeout: 20000,
    connections: {
      
    }
  }
};

export function loadConfig(configPath?: string): ServerConfig {
  // If no config path provided, look in default locations
  const configLocations = [
    configPath,
    path.join(process.cwd(), 'config.json'),
    path.join(os.homedir(), '.win-cli-mcp', 'config.json')
  ].filter(Boolean);

  let loadedConfig: Partial<ServerConfig> = {};

  for (const location of configLocations) {
    if (!location) continue;
    
    try {
      if (fs.existsSync(location)) {
        const fileContent = fs.readFileSync(location, 'utf8');
        loadedConfig = JSON.parse(fileContent);
        console.error(`Loaded config from ${location}`);
        break;
      }
    } catch (error) {
      console.error(`Error loading config from ${location}:`, error);
    }
  }

  // Use defaults only if no config was loaded
  const mergedConfig = Object.keys(loadedConfig).length > 0 
    ? mergeConfigs(DEFAULT_CONFIG, loadedConfig)
    : DEFAULT_CONFIG;

  // Validate the merged config
  validateConfig(mergedConfig);

  return mergedConfig;
}

function mergeConfigs(defaultConfig: ServerConfig, userConfig: Partial<ServerConfig>): ServerConfig {
  const merged: ServerConfig = {
    security: {
      // If user provided security config, use it entirely, otherwise use default
      ...(userConfig.security || defaultConfig.security)
    },
    shells: {
      // Same for each shell - if user provided config, use it entirely
      powershell: userConfig.shells?.powershell || defaultConfig.shells.powershell,
      cmd: userConfig.shells?.cmd || defaultConfig.shells.cmd,
      gitbash: userConfig.shells?.gitbash || defaultConfig.shells.gitbash
    },
    ssh: {
      // Merge SSH config
      ...(defaultConfig.ssh),
      ...(userConfig.ssh || {}),
      // Ensure connections are merged
      connections: {
        ...(defaultConfig.ssh.connections),
        ...(userConfig.ssh?.connections || {})
      }
    }
  };

  // Only add validatePath functions if they don't exist
  for (const [key, shell] of Object.entries(merged.shells) as [keyof typeof merged.shells, ShellConfig][]) {
    if (!shell.validatePath) {
      shell.validatePath = defaultConfig.shells[key].validatePath;
    }
  }

  return merged;
}

function validateConfig(config: ServerConfig): void {
  // Validate security settings
  if (config.security.maxCommandLength < 1) {
    throw new Error('maxCommandLength must be positive');
  }

  if (config.security.maxHistorySize < 1) {
    throw new Error('maxHistorySize must be positive');
  }

  // Validate shell configurations
  for (const [shellName, shell] of Object.entries(config.shells)) {
    if (shell.enabled && (!shell.command || !shell.args)) {
      throw new Error(`Invalid configuration for ${shellName}: missing command or args`);
    }
  }

  // Validate timeout (minimum 1 second)
  if (config.security.commandTimeout < 1) {
    throw new Error('commandTimeout must be at least 1 second');
  }

  // Validate SSH configuration
  if (config.ssh.enabled) {
    if (config.ssh.defaultTimeout < 1) {
      throw new Error('SSH defaultTimeout must be at least 1 second');
    }
    if (config.ssh.maxConcurrentSessions < 1) {
      throw new Error('SSH maxConcurrentSessions must be at least 1');
    }
    if (config.ssh.keepaliveInterval < 1000) {
      throw new Error('SSH keepaliveInterval must be at least 1000ms');
    }
    if (config.ssh.readyTimeout < 1000) {
      throw new Error('SSH readyTimeout must be at least 1000ms');
    }

    // Validate individual connections
    for (const [connId, conn] of Object.entries(config.ssh.connections)) {
      if (!conn.host || !conn.username || (!conn.password && !conn.privateKeyPath)) {
        throw new Error(`Invalid SSH connection config for '${connId}': missing required fields`);
      }
      if (conn.port && (conn.port < 1 || conn.port > 65535)) {
        throw new Error(`Invalid SSH port for '${connId}': must be between 1 and 65535`);
      }
    }
  }
}

// Helper function to create a default config file
export function createDefaultConfig(configPath: string): void {
  const dirPath = path.dirname(configPath);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Create a JSON-safe version of the config (excluding functions)
  const configForSave = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  fs.writeFileSync(configPath, JSON.stringify(configForSave, null, 2));
}