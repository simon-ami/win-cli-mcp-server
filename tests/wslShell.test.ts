import { loadConfig, validateConfig, DEFAULT_CONFIG } from '../src/utils/config';
import { createSerializableConfig } from '../src/utils/configUtils';
import { ServerConfig, ShellConfig } from '../src/types/config';
import * as fs from 'fs';

// Mock fs operations
jest.mock('fs');
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe('WSL Shell Configuration Tests', () => {

  beforeEach(() => {
    // Reset mocks before each test
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    // Default to config file not existing unless overridden in a test
    mockExistsSync.mockReturnValue(false);
  });

  // Test Suite 1: Default WSL Configuration
  describe('Default WSL Configuration (loadConfig)', () => {
    it('should load default WSL config when no user config is provided', () => {
      const config = loadConfig();
      const wslShellConfig = config.shells.wsl;
      const defaultWslConfig = DEFAULT_CONFIG.shells.wsl;

      expect(wslShellConfig.enabled).toBe(defaultWslConfig.enabled);
      expect(wslShellConfig.command).toBe(defaultWslConfig.command);
      expect(wslShellConfig.args).toEqual(defaultWslConfig.args);
      expect(wslShellConfig.wslDistributionName).toBe(defaultWslConfig.wslDistributionName);
      expect(wslShellConfig.blockedOperators).toEqual(defaultWslConfig.blockedOperators);
      expect(typeof wslShellConfig.validatePath).toBe('function');
      // Test validatePath with a sample valid path
      if (wslShellConfig.validatePath && defaultWslConfig.validatePath) {
         expect(wslShellConfig.validatePath('/mnt/c/Users')).toBe(true);
         expect(defaultWslConfig.validatePath('/mnt/c/Users')).toBe(true);
      }
    });
  });

  // Test Suite 2: User-Override of wslDistributionName
  describe('User-Override of wslDistributionName (loadConfig)', () => {
    it('should allow user to override wslDistributionName', () => {
      const userConfig: Partial<ServerConfig> = {
        shells: {
          wsl: { wslDistributionName: 'MyDebian' } as Partial<ShellConfig>,
        } as any, // Use 'any' to bypass other potentially missing shell configs for this test
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(userConfig));
      
      const config = loadConfig('dummy/path/config.json');
      expect(config.shells.wsl.wslDistributionName).toBe('MyDebian');
      // Check that other wsl properties are still from default
      expect(config.shells.wsl.command).toBe(DEFAULT_CONFIG.shells.wsl.command);
      expect(config.shells.wsl.enabled).toBe(DEFAULT_CONFIG.shells.wsl.enabled);
    });
  });

  // Test Suite 3: loadConfig Merging and Validation
  describe('loadConfig Merging and Validation', () => {
    it('should merge partial WSL config with defaults', () => {
      const userConfig = {
        shells: {
          wsl: { wslDistributionName: 'AlpineWSL' },
        },
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(userConfig));
      const config = loadConfig('dummy/path/config.json');

      expect(config.shells.wsl.wslDistributionName).toBe('AlpineWSL');
      expect(config.shells.wsl.command).toBe(DEFAULT_CONFIG.shells.wsl.command);
      expect(config.shells.wsl.args).toEqual(DEFAULT_CONFIG.shells.wsl.args);
      expect(config.shells.wsl.enabled).toBe(DEFAULT_CONFIG.shells.wsl.enabled);
      expect(typeof config.shells.wsl.validatePath).toBe('function');
    });

    it('should throw error if wsl is enabled and wslDistributionName is an empty string', () => {
      const userConfig = {
        shells: {
          wsl: { enabled: true, wslDistributionName: '' },
        },
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(userConfig));

      expect(() => loadConfig('dummy/path/config.json')).toThrow(
        'Invalid configuration for wsl: wslDistributionName must be a non-empty string when wsl is enabled'
      );
    });

    it('should throw error if wsl is enabled and wslDistributionName is missing (via undefined)', () => {
      const userConfig = {
        shells: {
          // Explicitly setting it undefined. mergeConfigs should pick this up before defaulting.
          wsl: { enabled: true, wslDistributionName: undefined } 
        },
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(userConfig));
      
      // This test relies on mergeConfigs preserving the `undefined` if the user explicitly set it,
      // rather than immediately overlaying with the default's wslDistributionName.
      // validateConfig then runs on this merged config.
      expect(() => loadConfig('dummy/path/config.json')).toThrow(
        'Invalid configuration for wsl: wslDistributionName must be a non-empty string when wsl is enabled'
      );
    });
  });

  // Test Suite 4: createSerializableConfig Output
  describe('createSerializableConfig Output', () => {
    it('should include wslDistributionName for WSL shell if set', () => {
      const fullConfig = loadConfig(); // Get a full default config
      fullConfig.shells.wsl.wslDistributionName = 'TestDistro';
      
      const serializableConfig = createSerializableConfig(fullConfig);
      expect(serializableConfig.shells.wsl.wslDistributionName).toBe('TestDistro');
    });

    it('should not include wslDistributionName for other shells', () => {
      const fullConfig = loadConfig(); // Get a full default config
      // Ensure wslDistributionName is not on powershell by default
      delete (fullConfig.shells.powershell as any).wslDistributionName; 

      const serializableConfig = createSerializableConfig(fullConfig);
      expect(serializableConfig.shells.powershell.wslDistributionName).toBeUndefined();
    });

     it('should not include wslDistributionName for WSL if not set (e.g. if it was optional and removed)', () => {
      const config: ServerConfig = {
        ...DEFAULT_CONFIG,
        shells: {
          ...DEFAULT_CONFIG.shells,
          wsl: {
            ...DEFAULT_CONFIG.shells.wsl,
          }
        }
      };
      delete config.shells.wsl.wslDistributionName; // Explicitly remove it

      const serializable = createSerializableConfig(config);
      expect(serializable.shells.wsl.wslDistributionName).toBeUndefined();
    });
  });

  // Test Suite 5: validateConfig Direct Invocation
  describe('validateConfig Direct Invocation', () => {
    let testConfig: ServerConfig;

    beforeEach(() => {
      // Get a deep copy of DEFAULT_CONFIG to modify in tests
      testConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    });

    it('should throw error if wsl is enabled and wslDistributionName is an empty string', () => {
      if (testConfig.shells.wsl) {
        testConfig.shells.wsl.enabled = true;
        testConfig.shells.wsl.wslDistributionName = '';
      }
      expect(() => validateConfig(testConfig)).toThrow(
        'Invalid configuration for wsl: wslDistributionName must be a non-empty string when wsl is enabled'
      );
    });

    it('should throw error if wsl is enabled and wslDistributionName is missing', () => {
      if (testConfig.shells.wsl) {
        testConfig.shells.wsl.enabled = true;
        delete testConfig.shells.wsl.wslDistributionName; // Simulate it missing
      }
      expect(() => validateConfig(testConfig)).toThrow(
        'Invalid configuration for wsl: wslDistributionName must be a non-empty string when wsl is enabled'
      );
    });

    it('should not throw for wsl if wsl is disabled, even with invalid wslDistributionName', () => {
       if (testConfig.shells.wsl) {
        testConfig.shells.wsl.enabled = false;
        testConfig.shells.wsl.wslDistributionName = ''; // Invalid, but wsl is disabled
      }
      expect(() => validateConfig(testConfig)).not.toThrow();
    });
  });
});
