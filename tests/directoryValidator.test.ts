import { describe, expect, test, jest } from '@jest/globals';
import {
  validateDirectories,
  validateDirectoriesAndThrow
} from '../src/utils/directoryValidator.js';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Mock the validation.js functions that directoryValidator.js depends on
jest.mock('../src/utils/validation.js', () => ({
  normalizeWindowsPath: jest.fn((path: string): string => {
    // Simple mock implementation for path normalization
    if (path.startsWith('/c/')) {
      return 'C:' + path.substring(2).replace(/\//g, '\\');
    }
    if (path.includes('/')) {
      return path.replace(/\//g, '\\');
    }
    return path;
  }),
  isPathAllowed: jest.fn((path: string, allowedPaths: string[]): boolean => {
    // Mock implementation to check if path is within allowed paths
    for (const allowedPath of allowedPaths) {
      if (path.toLowerCase().startsWith(allowedPath.toLowerCase())) {
        return true;
      }
    }
    return false;
  })
}));

describe('Directory Validator', () => {
  // Define test allowed paths
  const allowedPaths = ['C:\\Users\\test', 'D:\\Projects'];

  describe('validateDirectories', () => {
    test('should return valid for directories within allowed paths', () => {
      const directories = ['C:\\Users\\test\\docs', 'D:\\Projects\\web'];
      const result = validateDirectories(directories, allowedPaths);
      
      expect(result.isValid).toBe(true);
      expect(result.invalidDirectories).toHaveLength(0);
    });

    test('should return invalid for directories outside allowed paths', () => {
      const directories = ['C:\\Windows\\System32', 'E:\\NotAllowed'];
      const result = validateDirectories(directories, allowedPaths);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidDirectories).toEqual(directories);
    });

    test('should handle a mix of valid and invalid directories', () => {
      const validDir = 'C:\\Users\\test\\documents';
      const invalidDir = 'C:\\Program Files';
      const directories = [validDir, invalidDir];
      
      const result = validateDirectories(directories, allowedPaths);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidDirectories).toContain(invalidDir);
      expect(result.invalidDirectories).not.toContain(validDir);
    });

    test('should handle GitBash style paths', () => {
      const directories = ['/c/Users/test/docs', '/d/Projects/web'];
      const result = validateDirectories(directories, allowedPaths);
      
      expect(result.isValid).toBe(true);
      expect(result.invalidDirectories).toHaveLength(0);
    });

    test('should consider invalid paths that throw during normalization', () => {
      // Mock normalizeWindowsPath to throw for a specific path
      const validationModule = jest.requireMock('../src/utils/validation.js') as { normalizeWindowsPath: jest.Mock };
      validationModule.normalizeWindowsPath.mockImplementationOnce(() => {
        throw new Error('Invalid path format');
      });
      
      const directories = ['invalid://path', 'D:\\Projects\\web'];
      const result = validateDirectories(directories, allowedPaths);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidDirectories).toContain('invalid://path');
    });
  });

  describe('validateDirectoriesAndThrow', () => {
    test('should not throw for valid directories', () => {
      const directories = ['C:\\Users\\test\\docs', 'D:\\Projects\\web'];
      
      expect(() => {
        validateDirectoriesAndThrow(directories, allowedPaths);
      }).not.toThrow();
    });

    test('should throw McpError for invalid directories', () => {
      const directories = ['C:\\Windows\\System32', 'E:\\NotAllowed'];
      
      expect(() => {
        validateDirectoriesAndThrow(directories, allowedPaths);
      }).toThrow(McpError);
    });

    test('should include invalid directories in error message', () => {
      const invalidDir1 = 'C:\\Windows\\System32';
      const invalidDir2 = 'E:\\NotAllowed';
      const directories = [invalidDir1, invalidDir2];
      
      try {
        validateDirectoriesAndThrow(directories, allowedPaths);
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(ErrorCode.InvalidRequest);
        expect(error.message).toContain(invalidDir1);
        expect(error.message).toContain(invalidDir2);
        expect(error.message).toContain(allowedPaths[0]);
        expect(error.message).toContain(allowedPaths[1]);
      }
    });

    test('should handle empty directories array', () => {
      expect(() => {
        validateDirectoriesAndThrow([], allowedPaths);
      }).not.toThrow();
    });

    test('should handle empty allowed paths array', () => {
      const directories = ['C:\\Users\\test\\docs', 'D:\\Projects\\web'];
      
      expect(() => {
        validateDirectoriesAndThrow(directories, []);
      }).toThrow(McpError);
    });
  });
});
