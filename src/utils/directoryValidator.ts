import path from 'path';
import { normalizeWindowsPath, isPathAllowed } from './validation.js';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Validates a list of directories against allowed paths
 * @param directories List of directories to validate
 * @param allowedPaths List of allowed paths
 * @returns Object with validation result and error message if applicable
 */
export function validateDirectories(directories: string[], allowedPaths: string[]): { 
  isValid: boolean; 
  invalidDirectories: string[];
} {
  const invalidDirectories: string[] = [];
  
  // Normalize each directory and check if it's allowed
  for (const dir of directories) {
    try {
      // Normalize the path to Windows format
      const normalizedDir = normalizeWindowsPath(dir);
      
      // Check if the path is allowed
      if (!isPathAllowed(normalizedDir, allowedPaths)) {
        invalidDirectories.push(dir); // Store the original path for error reporting
      }
    } catch (error) {
      // If normalization fails, consider the directory invalid
      invalidDirectories.push(dir);
    }
  }
  
  return {
    isValid: invalidDirectories.length === 0,
    invalidDirectories
  };
}

/**
 * Validates directories and throws an error if any are not allowed
 * @param directories List of directories to validate
 * @param allowedPaths List of allowed paths
 * @throws McpError if any directory is not allowed
 */
export function validateDirectoriesAndThrow(directories: string[], allowedPaths: string[]): void {
  const result = validateDirectories(directories, allowedPaths);
  
  if (!result.isValid) {
    const invalidDirsStr = result.invalidDirectories.join(', ');
    const allowedPathsStr = allowedPaths.join(', ');
    
    // If one invalid directory is found, throw an error
    if (result.invalidDirectories.length === 1) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `The following directory is outside allowed paths: ${invalidDirsStr}. Allowed paths are: ${allowedPathsStr}. Commands with restricted directory is not allowed to execute.`
      );
    } else {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `The following directories are outside allowed paths: ${invalidDirsStr}. Allowed paths are: ${allowedPathsStr}. Commands with restricted directories are not allowed to execute.`
      );
    }
  }
}
