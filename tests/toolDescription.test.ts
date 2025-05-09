import { describe, expect, test } from '@jest/globals';
import { buildToolDescription } from '../src/utils/toolDescription.js';

describe('Tool Description Generation', () => {
  test('generates correct description with all shells enabled', () => {
    const allowedShells = ['powershell', 'cmd', 'gitbash'];
    const description = buildToolDescription(allowedShells);
    
    // Check header
    expect(description[0]).toBe('Execute a command in the specified shell (powershell, cmd, gitbash)');
    
    // Check that all examples are included
    expect(description).toContain('Example usage (PowerShell):');
    expect(description).toContain('Example usage (CMD):');
    expect(description).toContain('Example usage (Git Bash):');
    
    // Check specific content for each shell example
    const powershellLine = description.find(line => line.includes('"shell": "powershell"'));
    const cmdLine = description.find(line => line.includes('"shell": "cmd"'));
    const gitbashLine = description.find(line => line.includes('"shell": "gitbash"'));
    
    expect(powershellLine).toBeDefined();
    expect(cmdLine).toBeDefined();
    expect(gitbashLine).toBeDefined();
  });

  test('generates correct description with only cmd enabled', () => {
    const allowedShells = ['cmd'];
    const description = buildToolDescription(allowedShells);
    
    // Check header
    expect(description[0]).toBe('Execute a command in the specified shell (cmd)');
    
    // Check that only cmd example is included
    expect(description).toContain('Example usage (CMD):');
    expect(description).not.toContain('Example usage (PowerShell):');
    expect(description).not.toContain('Example usage (Git Bash):');
    
    // Check specific content
    const cmdLine = description.find(line => line.includes('"shell": "cmd"'));
    const powershellLine = description.find(line => line.includes('"shell": "powershell"'));
    const gitbashLine = description.find(line => line.includes('"shell": "gitbash"'));
    
    expect(cmdLine).toBeDefined();
    expect(powershellLine).toBeUndefined();
    expect(gitbashLine).toBeUndefined();
  });

  test('generates correct description with powershell and gitbash enabled', () => {
    const allowedShells = ['powershell', 'gitbash'];
    const description = buildToolDescription(allowedShells);
    
    // Check header
    expect(description[0]).toBe('Execute a command in the specified shell (powershell, gitbash)');
    
    // Check that only powershell and gitbash examples are included
    expect(description).toContain('Example usage (PowerShell):');
    expect(description).not.toContain('Example usage (CMD):');
    expect(description).toContain('Example usage (Git Bash):');
    
    // Check specific content
    const cmdLine = description.find(line => line.includes('"shell": "cmd"'));
    const powershellLine = description.find(line => line.includes('"shell": "powershell"'));
    const gitbashLine = description.find(line => line.includes('"shell": "gitbash"'));
    
    expect(cmdLine).toBeUndefined();
    expect(powershellLine).toBeDefined();
    expect(gitbashLine).toBeDefined();
  });

  test('handles empty allowed shells array', () => {
    const allowedShells: string[] = [];
    const description = buildToolDescription(allowedShells);
    
    // Check header
    expect(description[0]).toBe('Execute a command in the specified shell ()');
    
    // Check that no examples are included
    expect(description).not.toContain('Example usage (PowerShell):');
    expect(description).not.toContain('Example usage (CMD):');
    expect(description).not.toContain('Example usage (Git Bash):');
  });

  test('handles unknown shell names', () => {
    const allowedShells = ['unknown', 'shell'];
    const description = buildToolDescription(allowedShells);
    
    // Check header
    expect(description[0]).toBe('Execute a command in the specified shell (unknown, shell)');
    
    // Check that no examples are included for unknown shells
    expect(description).not.toContain('Example usage (PowerShell):');
    expect(description).not.toContain('Example usage (CMD):');
    expect(description).not.toContain('Example usage (Git Bash):');
  });
});
