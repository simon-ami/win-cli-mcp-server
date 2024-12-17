import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ShellConfig } from '../types/config.js';
const execAsync = promisify(exec);

export async function resolveCommandPath(command: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync(`where "${command}"`, { encoding: 'utf8' });
        return stdout.split('\n')[0].trim();
    } catch {
        return null;
    }
}

export function extractCommandName(command: string): string {
    // Remove any path components
    const basename = path.basename(command);
    // Remove extension
    return basename.replace(/\.(exe|cmd|bat)$/i, '');
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
    const normalizedPath = path.normalize(testPath).toLowerCase();
    return allowedPaths.some(allowedPath => {
        const normalizedAllowedPath = path.normalize(allowedPath).toLowerCase();
        return normalizedPath.startsWith(normalizedAllowedPath);
    });
}

export function validateWorkingDirectory(dir: string, allowedPaths: string[]): void {
    if (!path.isAbsolute(dir)) {
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
    // Convert forward slashes to backslashes
    let normalized = inputPath.replace(/\//g, '\\');
    
    // Handle Windows drive letter
    if (/^[a-zA-Z]:\\.+/.test(normalized)) {
        // Already in correct form
        return path.normalize(normalized);
    }
    
    // Handle paths without drive letter
    if (normalized.startsWith('\\')) {
        // Assume C: drive if not specified
        normalized = `C:${normalized}`;
    }
    
    return path.normalize(normalized);
}