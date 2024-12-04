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
    allowedPaths: [
      os.homedir(),
      process.cwd()
    ],
    restrictWorkingDirectory: true,
    logCommands: true,
    maxHistorySize: 1000
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

  // Deep merge with defaults
  const mergedConfig = mergeConfigs(DEFAULT_CONFIG, loadedConfig);

  // Validate the merged config
  validateConfig(mergedConfig);

  return mergedConfig;
}

function mergeConfigs(defaultConfig: ServerConfig, userConfig: Partial<ServerConfig>): ServerConfig {
  const merged: ServerConfig = {
    security: {
      ...defaultConfig.security,
      ...(userConfig.security || {}),
      // Merge arrays
      blockedCommands: [
        ...new Set([
          ...(defaultConfig.security.blockedCommands || []),
          ...(userConfig.security?.blockedCommands || [])
        ])
      ],
      allowedPaths: [
        ...new Set([
          ...(defaultConfig.security.allowedPaths || []),
          ...(userConfig.security?.allowedPaths || [])
        ])
      ]
    },
    shells: {
      powershell: { ...defaultConfig.shells.powershell, ...userConfig.shells?.powershell },
      cmd: { ...defaultConfig.shells.cmd, ...userConfig.shells?.cmd },
      gitbash: { ...defaultConfig.shells.gitbash, ...userConfig.shells?.gitbash }
    }
  };

  // Ensure validatePath functions are preserved if not overridden
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