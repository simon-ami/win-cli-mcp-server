import { ServerConfig } from '../types/config.js';

/**
 * Creates a structured copy of the configuration for external use
 * @param config The server configuration
 * @returns A serializable version of the configuration
 */
export function createSerializableConfig(config: ServerConfig): any {
  return {
    security: {
      maxCommandLength: config.security.maxCommandLength,
      blockedCommands: [...config.security.blockedCommands],
      blockedArguments: [...config.security.blockedArguments],
      allowedPaths: [...config.security.allowedPaths],
      restrictWorkingDirectory: config.security.restrictWorkingDirectory,
      commandTimeout: config.security.commandTimeout,
      enableInjectionProtection: config.security.enableInjectionProtection
    },
    shells: Object.entries(config.shells).reduce((acc, [key, shell]) => {
      acc[key] = {
        enabled: shell.enabled,
        command: shell.command,
        args: [...shell.args],
        blockedOperators: shell.blockedOperators ? [...shell.blockedOperators] : []
      };
      if (shell.wslDistributionName) {
        acc[key].wslDistributionName = shell.wslDistributionName;
      }
      return acc;
    }, {} as Record<string, any>)
  };
}
