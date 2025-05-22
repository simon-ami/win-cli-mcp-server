import path from 'path';
import type { ShellConfig } from '../types/config.js';

export function extractCommandName(command: string): string {
    // Replace backslashes with forward slashes
    const normalizedCommand = command.replace(/\\/g, '/');
    // Remove any path components
    const basename = path.basename(normalizedCommand);
    // Remove extension
    return basename.replace(/\.(exe|cmd|bat)$/i, '').toLowerCase();
}

export function isCommandBlocked(command: string, blockedCommands: string[]): boolean {
    const commandName = extractCommandName(command.toLowerCase());
    return blockedCommands.some(blocked => 
        commandName === blocked.toLowerCase() ||
        commandName === `${blocked.toLowerCase()}.exe` ||
        commandName === `${blocked.toLowerCase()}.cmd` ||
        commandName === `${blocked.toLowerCase()}.bat`
    );
}

export function isArgumentBlocked(args: string[], blockedArguments: string[]): boolean {
    return args.some(arg => 
        blockedArguments.some(blocked => 
            new RegExp(`^${blocked}$`, 'i').test(arg)
        )
    );
}

/**
 * Validates a command for a specific shell, checking for shell-specific blocked operators
 */
export function validateShellOperators(command: string, shellConfig: ShellConfig): void {
    // Skip validation if shell doesn't specify blocked operators
    if (!shellConfig.blockedOperators?.length) {
        return;
    }

    // Create regex pattern from blocked operators
    const operatorPattern = shellConfig.blockedOperators
        .map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))  // Escape regex special chars
        .join('|');
    
    const regex = new RegExp(operatorPattern);
    if (regex.test(command)) {
        throw new Error(`Command contains blocked operators for this shell: ${shellConfig.blockedOperators.join(', ')}`);
    }
}

/**
 * Parse a command string into command and arguments, properly handling paths with spaces and quotes
 */
export function parseCommand(fullCommand: string): { command: string; args: string[] } {
    fullCommand = fullCommand.trim();
    if (!fullCommand) {
        return { command: '', args: [] };
    }

    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    // Parse into tokens, preserving quoted strings
    for (let i = 0; i < fullCommand.length; i++) {
        const char = fullCommand[i];

        // Handle quotes
        if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
            if (inQuotes) {
                tokens.push(current);
                current = '';
            }
            inQuotes = !inQuotes;
            quoteChar = inQuotes ? char : '';
            continue;
        }

        // Handle spaces outside quotes
        if (char === ' ' && !inQuotes) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    // Add any remaining token
    if (current) {
        tokens.push(current);
    }

    // Handle empty input
    if (tokens.length === 0) {
        return { command: '', args: [] };
    }

    // First, check if this is a single-token command
    if (!tokens[0].includes(' ') && !tokens[0].includes('\\')) {
        return {
            command: tokens[0],
            args: tokens.slice(1)
        };
    }

    // Special handling for Windows paths with spaces
    let commandTokens: string[] = [];
    let i = 0;

    // Keep processing tokens until we find a complete command path
    while (i < tokens.length) {
        commandTokens.push(tokens[i]);
        const potentialCommand = commandTokens.join(' ');

        // Check if this could be a complete command path
        if (/\.(exe|cmd|bat)$/i.test(potentialCommand) || 
            (!potentialCommand.includes('\\') && commandTokens.length === 1)) {
            return {
                command: potentialCommand,
                args: tokens.slice(i + 1)
            };
        }

        // If this is part of a path, keep looking
        if (potentialCommand.includes('\\')) {
            i++;
            continue;
        }

        // If we get here, treat the first token as the command
        return {
            command: tokens[0],
            args: tokens.slice(1)
        };
    }

    // If we get here, use all collected tokens as the command
    return {
        command: commandTokens.join(' '),
        args: tokens.slice(commandTokens.length)
    };
}

export function isPathAllowed(testPath: string, allowedPaths: string[]): boolean {
    // Step 1: Normalize testPath
    const normalizedTestPath = normalizeWindowsPath(testPath)
        .toLowerCase()
        .replace(/\\$/, ''); // Remove trailing backslash

    // Step 2: Iterate through allowedPaths
    return allowedPaths.some(allowedPath => {
        // Step 2a: Normalize current allowedPath
        const normalizedAllowedPath = normalizeWindowsPath(allowedPath)
            .toLowerCase()
            .replace(/\\$/, ''); // Remove trailing backslash

        // Step 3: Comparison Logic
        // a. Exact match
        if (normalizedTestPath === normalizedAllowedPath) {
            return true;
        }
        // b. Starts with allowedPath + path separator
        // path.sep should be '\\' after normalizeWindowsPath
        if (normalizedTestPath.startsWith(normalizedAllowedPath + '\\')) {
            return true;
        }
        return false;
    });
}

export function validateWorkingDirectory(dir: string, allowedPaths: string[]): void {
    const isWindowsDriveAbsolute = /^[a-zA-Z]:\\/.test(dir);
    if (!isWindowsDriveAbsolute && !path.isAbsolute(dir)) {
        throw new Error('Working directory must be an absolute path');
    }

    if (!isPathAllowed(dir, allowedPaths)) {
        const allowedPathsStr = allowedPaths.join(', ');
        throw new Error(
            `Working directory must be within allowed paths: ${allowedPathsStr}`
        );
    }
}

export function normalizeWindowsPath(inputPath: string): string {
    let currentPath = inputPath; 

    const hadTrailingSlash = /[/\\]$/.test(currentPath) && currentPath.length > 1;

    currentPath = currentPath.replace(/\//g, '\\');

    const gitbashMatch = currentPath.match(/^\\([a-zA-Z])(\\|$)(.*)/);
    if (gitbashMatch) {
        currentPath = `${gitbashMatch[1].toUpperCase()}:\\${gitbashMatch[3]}`;
    } 
    else if (currentPath.startsWith('\\\\')) {
        // UNC path, already absolute
    } 
    else if (currentPath.startsWith('\\')) {
        const hasDriveLetterAfterInitialSlash = /^[a-zA-Z]:/.test(currentPath.substring(1));
        if (hasDriveLetterAfterInitialSlash) { 
            currentPath = currentPath.substring(1); 
        } else { 
            currentPath = `C:\\${currentPath.substring(1)}`; 
        }
    } 
    else { 
        if (/^[a-zA-Z]:(?![\\/])/.test(currentPath)) { 
            currentPath = `${currentPath.substring(0, 2)}\\${currentPath.substring(2)}`;
        } 
        else if (!/^[a-zA-Z]:/.test(currentPath)) { 
            currentPath = `C:\\${currentPath}`;
        }
    }
    
    let finalPath = path.normalize(currentPath);

    const driveLetterMatchCleanup = finalPath.match(/^([a-z]):(.*)/);
    if (driveLetterMatchCleanup) {
        finalPath = `${driveLetterMatchCleanup[1].toUpperCase()}:${driveLetterMatchCleanup[2]}`;
    }

    finalPath = finalPath.replace(/\\+/g, '\\');
    
    if (finalPath.match(/^[a-zA-Z]:$/)) {
        finalPath += '\\';
    }

    if (hadTrailingSlash && !finalPath.endsWith('\\')) {
        finalPath += '\\';
    } else if (!hadTrailingSlash && finalPath.endsWith('\\') && finalPath.length > 3) { 
        finalPath = finalPath.replace(/\\$/, ''); 
    }

    return finalPath;
}

export function normalizeAllowedPaths(paths: string[]): string[] {
    // Step 1: Initial Normalization
    const normalizedInputPaths = paths.map(p => normalizeWindowsPath(p).toLowerCase());

    // Step 2: Processing and Filtering
    const processedPaths: string[] = [];

    for (const currentPath of normalizedInputPaths) {
        // a. Create a version of currentPath without a trailing backslash
        const comparableCurrentPath = currentPath.replace(/\\$/, '');

        // b. Check for Duplicates
        if (processedPaths.some(existingPath => existingPath.replace(/\\$/, '') === comparableCurrentPath)) {
            continue;
        }

        // c. Check for Nesting (currentPath is child of an existing path)
        if (processedPaths.some(existingPath => {
            const comparableExistingPath = existingPath.replace(/\\$/, '');
            return comparableCurrentPath.startsWith(comparableExistingPath + '\\');
        })) {
            continue;
        }

        // d. Remove Existing Nested Children (existing path is child of currentPath)
        for (let i = processedPaths.length - 1; i >= 0; i--) {
            const comparableExistingPath = processedPaths[i].replace(/\\$/, '');
            if (comparableExistingPath.startsWith(comparableCurrentPath + '\\')) {
                processedPaths.splice(i, 1);
            }
        }
        
        // e. Add comparableCurrentPath (the version without the trailing slash)
        processedPaths.push(comparableCurrentPath);
    }

    // Step 3: Return
    return processedPaths;
}
