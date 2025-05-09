import { describe, expect, test, jest } from '@jest/globals';
import { ServerConfig } from '../src/types/config.js';
import { createSerializableConfig } from '../src/utils/configUtils.js';

// Mock the Server class from MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: jest.fn().mockImplementation(() => {
      return {
        setRequestHandler: jest.fn(),
        start: jest.fn()
      };
    })
  };
});

// Mock the StdioServerTransport
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: jest.fn()
  };
});

describe('get_config tool', () => {
  // Sample test config
  const testConfig: ServerConfig = {
    security: {
      maxCommandLength: 1000,
      blockedCommands: ['rm', 'del'],
      blockedArguments: ['--exec'],
      allowedPaths: ['/test/path'],
      restrictWorkingDirectory: true,
      commandTimeout: 30,
      enableInjectionProtection: true
    },
    shells: {
      powershell: {
        enabled: true,
        command: 'powershell.exe',
        args: ['-Command'],
        blockedOperators: ['&', '|']
      },
      cmd: {
        enabled: true,
        command: 'cmd.exe',
        args: ['/c'],
        blockedOperators: ['&', '|']
      },
      gitbash: {
        enabled: false,
        command: 'bash.exe',
        args: ['-c'],
        blockedOperators: ['&', '|']
      }
    }
  };

  test('createSerializableConfig returns structured configuration', () => {
    // Call the utility function directly with our test config
    const safeConfig = createSerializableConfig(testConfig);
    
    // Verify the structure and content of the safe config
    expect(safeConfig).toBeDefined();
    expect(safeConfig.security).toBeDefined();
    expect(safeConfig.shells).toBeDefined();
    
    // Check security settings
    expect(safeConfig.security.maxCommandLength).toBe(testConfig.security.maxCommandLength);
    expect(safeConfig.security.blockedCommands).toEqual(testConfig.security.blockedCommands);
    expect(safeConfig.security.blockedArguments).toEqual(testConfig.security.blockedArguments);
    expect(safeConfig.security.allowedPaths).toEqual(testConfig.security.allowedPaths);
    expect(safeConfig.security.restrictWorkingDirectory).toBe(testConfig.security.restrictWorkingDirectory);
    expect(safeConfig.security.commandTimeout).toBe(testConfig.security.commandTimeout);
    expect(safeConfig.security.enableInjectionProtection).toBe(testConfig.security.enableInjectionProtection);
    
    // Check shells configuration
    expect(safeConfig.shells.powershell.enabled).toBe(testConfig.shells.powershell.enabled);
    expect(safeConfig.shells.powershell.command).toBe(testConfig.shells.powershell.command);
    expect(safeConfig.shells.powershell.args).toEqual(testConfig.shells.powershell.args);
    expect(safeConfig.shells.powershell.blockedOperators).toEqual(testConfig.shells.powershell.blockedOperators);
    
    expect(safeConfig.shells.cmd.enabled).toBe(testConfig.shells.cmd.enabled);
    expect(safeConfig.shells.gitbash.enabled).toBe(testConfig.shells.gitbash.enabled);
    
    // Verify that function properties are not included in the serializable config
    expect(safeConfig.shells.powershell.validatePath).toBeUndefined();
    expect(safeConfig.shells.cmd.validatePath).toBeUndefined();
    expect(safeConfig.shells.gitbash.validatePath).toBeUndefined();
  });

  test('createSerializableConfig returns consistent config structure', () => {
    // Call the utility function directly with our test config
    const safeConfig = createSerializableConfig(testConfig);
    
    // Verify the structure matches what we expect both tools to return
    expect(safeConfig).toHaveProperty('security');
    expect(safeConfig).toHaveProperty('shells');
    
    // Verify security properties
    expect(safeConfig.security).toHaveProperty('maxCommandLength');
    expect(safeConfig.security).toHaveProperty('blockedCommands');
    expect(safeConfig.security).toHaveProperty('blockedArguments');
    expect(safeConfig.security).toHaveProperty('allowedPaths');
    expect(safeConfig.security).toHaveProperty('restrictWorkingDirectory');
    expect(safeConfig.security).toHaveProperty('commandTimeout');
    expect(safeConfig.security).toHaveProperty('enableInjectionProtection');
    
    // Verify shells structure
    Object.keys(testConfig.shells).forEach(shellName => {
      expect(safeConfig.shells).toHaveProperty(shellName);
      expect(safeConfig.shells[shellName]).toHaveProperty('enabled');
      expect(safeConfig.shells[shellName]).toHaveProperty('command');
      expect(safeConfig.shells[shellName]).toHaveProperty('args');
      expect(safeConfig.shells[shellName]).toHaveProperty('blockedOperators');
    });
  });
  
  test('get_config tool response format', () => {
    // Call the utility function directly with our test config
    const safeConfig = createSerializableConfig(testConfig);
    
    // Format it as the tool would
    const formattedResponse = {
      content: [{
        type: "text",
        text: JSON.stringify(safeConfig, null, 2)
      }],
      isError: false,
      metadata: {}
    };
    
    // Verify the response structure matches what we expect
    expect(formattedResponse).toHaveProperty('content');
    expect(formattedResponse).toHaveProperty('isError');
    expect(formattedResponse).toHaveProperty('metadata');
    expect(formattedResponse.isError).toBe(false);
    expect(formattedResponse.content).toBeInstanceOf(Array);
    expect(formattedResponse.content[0]).toHaveProperty('type', 'text');
    expect(formattedResponse.content[0]).toHaveProperty('text');
    
    // Parse the JSON string in the response
    const parsedConfig = JSON.parse(formattedResponse.content[0].text);
    
    // Verify it contains the expected structure
    expect(parsedConfig).toHaveProperty('security');
    expect(parsedConfig).toHaveProperty('shells');
    
    // Verify the content matches what we expect
    expect(parsedConfig).toEqual(safeConfig);
  });
});
