export interface SecurityConfig {
  maxCommandLength: number;
  blockedCommands: string[];
  blockedArguments: string[];
  allowedPaths: string[];
  restrictWorkingDirectory: boolean;
  commandTimeout: number;
  enableInjectionProtection: boolean;
}

export interface ShellConfig {
  enabled: boolean;
  command: string;
  args: string[];
  validatePath?: (dir: string) => boolean;
  blockedOperators?: string[]; // Added for shell-specific operator restrictions
}

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  keepaliveInterval?: number;
  keepaliveCountMax?: number;
  readyTimeout?: number;
}

export interface SSHConfig {
  enabled: boolean;
  connections: Record<string, SSHConnectionConfig>;
  defaultTimeout: number;
  maxConcurrentSessions: number;
  keepaliveInterval: number;
  keepaliveCountMax: number;
  readyTimeout: number;
}

export interface ServerConfig {
  security: SecurityConfig;
  shells: {
    powershell: ShellConfig;
    cmd: ShellConfig;
    gitbash: ShellConfig;
  };
  ssh: SSHConfig;
}