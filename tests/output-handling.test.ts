import path from 'path';
import fs from 'fs';
import os from 'os';
import { DEFAULT_CONFIG, validateConfig } from '../src/utils/config.js';
import type { ServerConfig } from '../src/types/config.js';

describe('Output handling configuration', () => {
  let testConfig: ServerConfig;
  let testOutputDir: string;

  beforeEach(() => {
    testConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    // Create test output directory
    testOutputDir = path.join(os.tmpdir(), `win-cli-mcp-test-${Date.now()}`);
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  test('validates output size limits in config', () => {
    expect(DEFAULT_CONFIG.security.maxOutputSize).toBe(512 * 1024 * 1024 - 1024 * 1024); // 511MB
  });

  test('output directory is created when enabled', () => {
    testConfig.security.enableOutputFiles = true;
    testConfig.security.outputDirectory = testOutputDir;

    // Verify directory exists
    expect(fs.existsSync(testOutputDir)).toBe(true);

    // Verify we can write to it
    const testFile = path.join(testOutputDir, 'test.txt');
    expect(() => {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    }).not.toThrow();
  });

  test('default temp directory is used when no custom directory specified', () => {
    testConfig.security.enableOutputFiles = true;
    testConfig.security.outputDirectory = undefined;

    const expectedDir = path.join(os.tmpdir(), 'win-cli-mcp-output');
    
    // If directory exists from previous tests, clean it up
    if (fs.existsSync(expectedDir)) {
      fs.rmSync(expectedDir, { recursive: true });
    }

    // Create dir through config validation
    validateConfig(testConfig);
    
    expect(fs.existsSync(expectedDir)).toBe(true);
    expect(testConfig.security.outputDirectory).toBe(expectedDir);

    // Cleanup
    fs.rmSync(expectedDir, { recursive: true });
  });

  test('config validation rejects invalid retention hours', () => {
    testConfig.security.outputFileRetentionHours = 0;
    expect(() => validateConfig(testConfig)).toThrow('outputFileRetentionHours must be at least 1');
  });

  test('config validation rejects invalid output size', () => {
    testConfig.security.maxOutputSize = 512 * 1024; // 512KB - too small
    expect(() => validateConfig(testConfig)).toThrow('maxOutputSize must be at least 1MB');
  });
});