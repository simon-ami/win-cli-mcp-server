import fs from 'fs';
import path from 'path';
import { ServerConfig } from '../types/config.js';
import { loadConfig as loadMainConfig } from './config.js';

/**
 * Load the current configuration from the config file.
 */
const loadConfig = (): ServerConfig => {
  try {
    // Use the same config file that the main application uses
    return loadMainConfig();
  } catch (error) {
    console.error('Error loading configuration:', error);
    throw error;
  }
};

/**
 * Save the updated configuration to the config file.
 * @param config The updated configuration object.
 */
const saveConfig = (config: ServerConfig): void => {
  try {
    // Use the actual config path from the process args or default
    const args = process.argv.slice(2);
    let configPath = './config.json';
    
    // Try to find a config path in the arguments
    for (let i = 0; i < args.length - 1; i++) {
      if ((args[i] === '--config' || args[i] === '-c') && args[i + 1]) {
        configPath = args[i + 1];
        break;
      }
    }
    
    // Resolve the path to be safe
    const resolvedPath = path.resolve(configPath);
    fs.writeFileSync(resolvedPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving configuration:', error);
    throw error;
  }
};

/**
 * Create a new SSH connection.
 * @param connectionId The ID for the new connection.
 * @param connectionConfig The configuration for the new connection.
 */
const createSSHConnection = (connectionId: string, connectionConfig: any): void => {
  const config = loadConfig();
  config.ssh.connections[connectionId] = connectionConfig;
  saveConfig(config);
};

/**
 * Read all SSH connections.
 * @returns An object containing all SSH connections.
 */
const readSSHConnections = (): object => {
  const config = loadConfig();
  return config.ssh.connections;
};

/**
 * Update an existing SSH connection.
 * @param connectionId The ID of the connection to update.
 * @param connectionConfig The new configuration for the connection.
 */
const updateSSHConnection = (connectionId: string, connectionConfig: any): void => {
  const config = loadConfig();
  if (config.ssh.connections[connectionId]) {
    config.ssh.connections[connectionId] = connectionConfig;
    saveConfig(config);
  }
};

/**
 * Delete an SSH connection.
 * @param connectionId The ID of the connection to delete.
 */
const deleteSSHConnection = (connectionId: string): void => {
  const config = loadConfig();
  delete config.ssh.connections[connectionId];
  saveConfig(config);
};

export { createSSHConnection, readSSHConnections, updateSSHConnection, deleteSSHConnection }; 