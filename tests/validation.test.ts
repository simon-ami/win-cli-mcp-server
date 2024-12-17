import { describe, expect, test } from '@jest/globals';
import path from 'path';
import {
  isCommandBlocked,
  isArgumentBlocked,
  parseCommand,
  extractCommandName,
  isPathAllowed,
  validateWorkingDirectory,
  normalizeWindowsPath,
  validateShellOperators
} from '../src/utils/validation.js';
import type { ShellConfig } from '../src/types/config.js';

describe('Command Validation', () => {
  // [Previous test blocks remain unchanged...]

  describe('validateShellOperators', () => {
    test('should allow PowerShell pipe operator', () => {
      const powershellConfig: ShellConfig = {
        enabled: true,
        command: 'powershell.exe',
        args: ['-Command'],
        blockedOperators: ['&', ';', '`']
      };

      // Should not throw for pipe operator
      expect(() => validateShellOperators('Get-Process | Select-Object Name', powershellConfig)).not.toThrow();
      expect(() => validateShellOperators('AzureDiagnostics | take 2', powershellConfig)).not.toThrow();
      
      // Should throw for other operators
      expect(() => validateShellOperators('Get-Process & Get-Service', powershellConfig)).toThrow();
      expect(() => validateShellOperators('Get-Process; Get-Service', powershellConfig)).toThrow();
      expect(() => validateShellOperators('echo `hello`', powershellConfig)).toThrow();
    });

    test('should block all operators in CMD', () => {
      const cmdConfig: ShellConfig = {
        enabled: true,
        command: 'cmd.exe',
        args: ['/c'],
        blockedOperators: ['&', '|', ';', '`']
      };

      expect(() => validateShellOperators('dir | findstr "test"', cmdConfig)).toThrow();
      expect(() => validateShellOperators('dir & echo done', cmdConfig)).toThrow();
      expect(() => validateShellOperators('dir; echo done', cmdConfig)).toThrow();
      expect(() => validateShellOperators('echo `test`', cmdConfig)).toThrow();
    });

    test('should handle undefined blockedOperators', () => {
      const noBlocksConfig: ShellConfig = {
        enabled: true,
        command: 'powershell.exe',
        args: ['-Command']
      };

      // Should not throw for any operators when no blocks defined
      expect(() => validateShellOperators('command1 | command2', noBlocksConfig)).not.toThrow();
      expect(() => validateShellOperators('command1 & command2', noBlocksConfig)).not.toThrow();
    });

    test('should handle complex PowerShell pipes', () => {
      const powershellConfig: ShellConfig = {
        enabled: true,
        command: 'powershell.exe',
        args: ['-Command'],
        blockedOperators: ['&', ';', '`']
      };

      // Test complex piping scenarios
      expect(() => validateShellOperators(
        'Get-Process | Where-Object CPU -gt 10 | Sort-Object CPU -Descending',
        powershellConfig
      )).not.toThrow();
      
      expect(() => validateShellOperators(
        'AzureDiagnostics | where TimeGenerated > ago(1h) | take 10',
        powershellConfig
      )).not.toThrow();

      // Should still catch other operators even in complex commands
      expect(() => validateShellOperators(
        'Get-Process | Sort-Object CPU; Get-Service',
        powershellConfig
      )).toThrow();
    });

    test('should handle whitespace around operators', () => {
      const powershellConfig: ShellConfig = {
        enabled: true,
        command: 'powershell.exe',
        args: ['-Command'],
        blockedOperators: ['&', ';', '`']
      };

      // Test various whitespace arrangements
      expect(() => validateShellOperators('Get-Process|Select-Object Name', powershellConfig)).not.toThrow();
      expect(() => validateShellOperators('Get-Process |Select-Object Name', powershellConfig)).not.toThrow();
      expect(() => validateShellOperators('Get-Process| Select-Object Name', powershellConfig)).not.toThrow();
      expect(() => validateShellOperators('Get-Process | Select-Object Name', powershellConfig)).not.toThrow();

      // Should still catch blocked operators with whitespace
      expect(() => validateShellOperators('Get-Process & Get-Service', powershellConfig)).toThrow();
      expect(() => validateShellOperators('Get-Process &Get-Service', powershellConfig)).toThrow();
      expect(() => validateShellOperators('Get-Process&Get-Service', powershellConfig)).toThrow();
    });
  });
});