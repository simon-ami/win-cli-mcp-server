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
    enableInjectionProtection: true,
    maxOutputSize: 512 * 1024 * 1024 - 1024 * 1024, // 511MB (1MB safety buffer)
    enableOutputFiles: false,
    outputDirectory: undefined,
    outputFileRetentionHours: 24
  },
  shells: {
    powershell: {
      enabled: true,
      command: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command'],
      validatePath: (dir: string) => dir.match(defaultValidatePathRegex) !== null,
      blockedOperators: ['&', '|', ';', '`']
    },
    cmd: {
      enabled: true,
      command: 'cmd.exe',
      args: ['/c'],
      validatePath: (dir: string) => dir.match(defaultValidatePathRegex) !== null,
      blockedOperators: ['&', '|', ';', '`']
    },
    gitbash: {
      enabled: true,
      command: 'C:\\Program Files\\Git\\bin\\bash.exe',
      args: ['-c'],
      validatePath: (dir: string) => dir.match(defaultValidatePathRegex) !== null,
      blockedOperators: ['&', '|', ';', '`']
    }
  },
  ssh: {
    enabled: false,
    defaultTimeout: 30,
    maxConcurrentSessions: 5,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    readyTimeout: 20000,
    connections: {}
  }
};

export function loadConfig(configPath?: string): ServerConfig {
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

  const mergedConfig = Object.keys(loadedConfig).length > 0 
    ? mergeConfigs(DEFAULT_CONFIG, loadedConfig)
    : DEFAULT_CONFIG;

  validateConfig(mergedConfig);

  return mergedConfig;
}

function mergeConfigs(defaultConfig: ServerConfig, userConfig: Partial<ServerConfig>): ServerConfig {
  const merged: ServerConfig = {
    security: {
      ...(userConfig.security || defaultConfig.security)
    },
    shells: {
      powershell: userConfig.shells?.powershell || defaultConfig.shells.powershell,
      cmd: userConfig.shells?.cmd || defaultConfig.shells.cmd,
      gitbash: userConfig.shells?.gitbash || defaultConfig.shells.gitbash
    },
    ssh: {
      ...(defaultConfig.ssh),
      ...(userConfig.ssh || {}),
      connections: {
        ...(defaultConfig.ssh.connections),
        ...(userConfig.ssh?.connections || {})
      }
    }
  };

  for (const [key, shell] of Object.entries(merged.shells) as [keyof typeof merged.shells, ShellConfig][]) {
    if (!shell.validatePath) {
      shell.validatePath = defaultConfig.shells[key].validatePath;
    }
    if (!shell.blockedOperators) {
      shell.blockedOperators = defaultConfig.shells[key].blockedOperators;
    }
  }

  return merged;
}

export function validateConfig(config: ServerConfig): void {
  if (config.security.maxCommandLength < 1) {
    throw new Error('maxCommandLength must be positive');
  }

  if (config.security.maxHistorySize < 1) {
    throw new Error('maxHistorySize must be positive');
  }

  for (const [shellName, shell] of Object.entries(config.shells)) {
    if (shell.enabled && (!shell.command || !shell.args)) {
      throw new Error(`Invalid configuration for ${shellName}: missing command or args`);
    }
  }

  if (config.security.commandTimeout < 1) {
    throw new Error('commandTimeout must be at least 1 second');
  }

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

    for (const [connId, conn] of Object.entries(config.ssh.connections)) {
      if (!conn.host || !conn.username || (!conn.password && !conn.privateKeyPath)) {
        throw new Error(`Invalid SSH connection config for '${connId}': missing required fields`);
      }
      if (conn.port && (conn.port < 1 || conn.port > 65535)) {
        throw new Error(`Invalid SSH port for '${connId}': must be between 1 and 65535`);
      }
    }
  }

  if (config.security.maxOutputSize < 1024 * 1024) {
    throw new Error('maxOutputSize must be at least 1MB');
  }

  if (config.security.outputFileRetentionHours < 1) {
    throw new Error('outputFileRetentionHours must be at least 1');
  }

  if (config.security.enableOutputFiles) {
    const outputDir = config.security.outputDirectory || path.join(os.tmpdir(), 'win-cli-mcp-output');
    try {
      fs.mkdirSync(outputDir, { recursive: true });

      const testFile = path.join(outputDir, '.write-test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);

      if (!config.security.outputDirectory) {
        config.security.outputDirectory = outputDir;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to setup output directory (${outputDir}): ${error.message}`);
      } else {
        throw new Error(`Failed to setup output directory (${outputDir}): ${String(error)}`);
      }
    }
  }
}

export function createDefaultConfig(configPath: string): void {
  const dirPath = path.dirname(configPath);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const configForSave = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  fs.writeFileSync(configPath, JSON.stringify(configForSave, null, 2));
}