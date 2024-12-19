import path from 'path';
import fs from 'fs';
import os from 'os';
import { DEFAULT_CONFIG, validateConfig } from '../src/utils/config.js';
import type { ServerConfig } from '../src/types/config.js';

describe('Config Validation', () => {
  let testConfig: ServerConfig;

  beforeEach(() => {
    testConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
  });

  test('validates output directory when enabled', () => {
    testConfig.security.enableOutputFiles = true;
    testConfig.security.outputDirectory = 'Z:\\nonexistent\\dir'; // Windows path format
    expect(() => validateConfig(testConfig)).toThrow('Failed to setup output directory');
  });

  test('creates default output directory in temp', () => {
    testConfig.security.enableOutputFiles = true;
    testConfig.security.outputDirectory = undefined;
    
    validateConfig(testConfig);
    
    const expectedDir = path.join(os.tmpdir(), 'win-cli-mcp-output');
    expect(fs.existsSync(expectedDir)).toBe(true);
    
    // Cleanup
    fs.rmdirSync(expectedDir);
  });

  test('validates retention hours', () => {
    testConfig.security.outputFileRetentionHours = 0;
    expect(() => validateConfig(testConfig)).toThrow('outputFileRetentionHours must be at least 1');
  });
});