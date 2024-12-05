import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
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

export function parseCommand(fullCommand: string): { command: string; args: string[] } {
    const parts = fullCommand.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
    const command = parts[0] || '';
    const args = parts.slice(1).map(arg => arg.replace(/^["']|["']$/g, ''));
    return { command, args };
}