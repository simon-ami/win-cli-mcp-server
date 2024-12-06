import { describe, expect, test } from '@jest/globals';
import path from 'path';
import {
  isCommandBlocked,
  isArgumentBlocked,
  parseCommand,
  extractCommandName,
  isPathAllowed,
  validateWorkingDirectory,
  normalizeWindowsPath
} from '../src/utils/validation.js';

describe('Command Validation', () => {
  describe('isCommandBlocked', () => {
    const blockedCommands = ['rm', 'del', 'format'];

    test('should detect blocked commands', () => {
      expect(isCommandBlocked('rm', blockedCommands)).toBe(true);
      expect(isCommandBlocked('del', blockedCommands)).toBe(true);
      expect(isCommandBlocked('format', blockedCommands)).toBe(true);
    });

    test('should allow non-blocked commands', () => {
      expect(isCommandBlocked('dir', blockedCommands)).toBe(false);
      expect(isCommandBlocked('echo', blockedCommands)).toBe(false);
      expect(isCommandBlocked('type', blockedCommands)).toBe(false);
    });

    test('should handle commands with paths', () => {
      expect(isCommandBlocked('C:\\Windows\\System32\\rm.exe', blockedCommands)).toBe(true);
      expect(isCommandBlocked('C:\\Windows\\System32\\dir.exe', blockedCommands)).toBe(false);
    });

    test('should be case-insensitive', () => {
      expect(isCommandBlocked('RM', blockedCommands)).toBe(true);
      expect(isCommandBlocked('Del', blockedCommands)).toBe(true);
      expect(isCommandBlocked('FORMAT', blockedCommands)).toBe(true);
    });
  });

  describe('isArgumentBlocked', () => {
    const blockedPatterns = ['--system', '--force', '-rf'];

    test('should detect blocked argument patterns', () => {
      expect(isArgumentBlocked(['--help', '--system'], blockedPatterns)).toBe(true);
      expect(isArgumentBlocked(['-rf'], blockedPatterns)).toBe(true);
      expect(isArgumentBlocked(['--force', 'file.txt'], blockedPatterns)).toBe(true);
    });

    test('should allow safe arguments', () => {
      expect(isArgumentBlocked(['--help'], blockedPatterns)).toBe(false);
      expect(isArgumentBlocked(['-l', 'file.txt'], blockedPatterns)).toBe(false);
      expect(isArgumentBlocked(['test.txt', '--verbose'], blockedPatterns)).toBe(false);
    });

    test('should handle empty arguments', () => {
      expect(isArgumentBlocked([], blockedPatterns)).toBe(false);
    });
  });

  describe('parseCommand', () => {
    test('should parse simple commands', () => {
      const result = parseCommand('echo hello');
      expect(result).toEqual({
        command: 'echo',
        args: ['hello']
      });
    });

    test('should handle commands with multiple arguments', () => {
      const result = parseCommand('git commit -m "test message"');
      expect(result).toEqual({
        command: 'git',
        args: ['commit', '-m', 'test message']
      });
    });

    test('should preserve quoted strings', () => {
      const result = parseCommand('echo "hello world" \'test quote\'');
      expect(result).toEqual({
        command: 'echo',
        args: ['hello world', 'test quote']
      });
    });

    test('should handle commands with no arguments', () => {
      const result = parseCommand('dir');
      expect(result).toEqual({
        command: 'dir',
        args: []
      });
    });

    test('should handle Windows paths with spaces', () => {
      const result = parseCommand('C:\\Program Files\\Git\\bin\\git.exe status');
      expect(result).toEqual({
        command: 'C:\\Program Files\\Git\\bin\\git.exe',
        args: ['status']
      });
    });

    test('should handle quoted Windows paths', () => {
      const result = parseCommand('"C:\\Program Files\\Git\\bin\\git.exe" status');
      expect(result).toEqual({
        command: 'C:\\Program Files\\Git\\bin\\git.exe',
        args: ['status']
      });
    });

    test('should handle paths with spaces in arguments', () => {
      const result = parseCommand('copy "C:\\My Files\\source.txt" "D:\\Target Files\\dest.txt"');
      expect(result).toEqual({
        command: 'copy',
        args: ['C:\\My Files\\source.txt', 'D:\\Target Files\\dest.txt']
      });
    });

    test('should handle mixed quotes and spaces', () => {
      const result = parseCommand('"C:\\Program Files\\App\\tool.exe" -f "test file.txt" --option="some value"');
      expect(result).toEqual({
        command: 'C:\\Program Files\\App\\tool.exe',
        args: ['-f', 'test file.txt', '--option=some value']
      });
    });

    test('should handle empty command string', () => {
      const result = parseCommand('');
      expect(result).toEqual({
        command: '',
        args: []
      });
    });

    test('should handle command with only spaces', () => {
      const result = parseCommand('   ');
      expect(result).toEqual({
        command: '',
        args: []
      });
    });
  });

  describe('extractCommandName', () => {
    test('should extract command name from simple command', () => {
      expect(extractCommandName('echo')).toBe('echo');
    });

    test('should extract command name from path', () => {
      expect(extractCommandName('C:\\Windows\\System32\\cmd.exe')).toBe('cmd');
    });

    test('should handle different path separators', () => {
      expect(extractCommandName('/usr/bin/git')).toBe('git');
      expect(extractCommandName('C:\\Program Files\\Git\\bin\\git.exe')).toBe('git');
    });

    test('should handle commands without extension', () => {
      expect(extractCommandName('C:\\Windows\\System32\\where')).toBe('where');
      expect(extractCommandName('/usr/bin/ls')).toBe('ls');
    });

    test('should handle commands with different extensions', () => {
      expect(extractCommandName('script.bat')).toBe('script');
      expect(extractCommandName('tool.cmd')).toBe('tool');
      expect(extractCommandName('program.exe')).toBe('program');
    });
  });

  describe('Path Validation', () => {
    describe('isPathAllowed', () => {
      const allowedPaths = [
        'C:\\Users\\TestUser',
        'D:\\Projects'
      ];

      test('should allow paths within allowed directories', () => {
        expect(isPathAllowed('C:\\Users\\TestUser\\file.txt', allowedPaths)).toBe(true);
        expect(isPathAllowed('C:\\Users\\TestUser\\subfolder\\file.txt', allowedPaths)).toBe(true);
        expect(isPathAllowed('D:\\Projects\\test\\script.js', allowedPaths)).toBe(true);
      });

      test('should reject paths outside allowed directories', () => {
        expect(isPathAllowed('C:\\Windows\\System32\\file.txt', allowedPaths)).toBe(false);
        expect(isPathAllowed('E:\\OtherFolder\\file.txt', allowedPaths)).toBe(false);
      });

      test('should handle case insensitivity', () => {
        expect(isPathAllowed('c:\\users\\testuser\\file.txt', allowedPaths)).toBe(true);
        expect(isPathAllowed('D:\\PROJECTS\\test.txt', allowedPaths)).toBe(true);
      });

      test('should handle path normalization', () => {
        expect(isPathAllowed('C:\\Users\\TestUser\\..\\TestUser\\file.txt', allowedPaths)).toBe(true);
        expect(isPathAllowed('C:\\Users\\.\\TestUser\\file.txt', allowedPaths)).toBe(true);
      });
    });

    describe('validateWorkingDirectory', () => {
      const allowedPaths = ['C:\\Users\\TestUser', 'D:\\Projects'];

      test('should allow valid working directories', () => {
        expect(() => validateWorkingDirectory('C:\\Users\\TestUser\\project', allowedPaths)).not.toThrow();
        expect(() => validateWorkingDirectory('D:\\Projects\\test', allowedPaths)).not.toThrow();
      });

      test('should reject relative paths', () => {
        expect(() => validateWorkingDirectory('.\\project', allowedPaths)).toThrow();
        expect(() => validateWorkingDirectory('project\\subfolder', allowedPaths)).toThrow();
      });

      test('should reject unauthorized paths', () => {
        expect(() => validateWorkingDirectory('C:\\Windows\\System32', allowedPaths)).toThrow();
        expect(() => validateWorkingDirectory('E:\\OtherFolder', allowedPaths)).toThrow();
      });
    });

    describe('normalizeWindowsPath', () => {
      test('should handle forward slashes', () => {
        expect(normalizeWindowsPath('C:/Users/Test')).toBe('C:\\Users\\Test');
      });

      test('should handle backslashes', () => {
        expect(normalizeWindowsPath('C:\\Users\\Test')).toBe('C:\\Users\\Test');
      });

      test('should handle mixed slashes', () => {
        expect(normalizeWindowsPath('C:\\Users/Test/folder')).toBe('C:\\Users\\Test\\folder');
      });

      test('should handle paths without drive letter', () => {
        expect(normalizeWindowsPath('\\Users\\Test')).toBe('C:\\Users\\Test');
      });

      test('should normalize double slashes', () => {
        expect(normalizeWindowsPath('C:\\\\Users\\\\Test')).toBe('C:\\Users\\Test');
      });

      test('should handle relative path elements', () => {
        expect(normalizeWindowsPath('C:\\Users\\..\\Test')).toBe('C:\\Test');
        expect(normalizeWindowsPath('C:\\Users\\.\\Test')).toBe('C:\\Users\\Test');
      });
    });
  });
});