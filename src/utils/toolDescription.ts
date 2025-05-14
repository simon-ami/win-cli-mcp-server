/**
 * Builds the tool description dynamically based on enabled shells
 * @param allowedShells Array of enabled shell names
 * @returns Array of description lines
 */
export function buildToolDescription(allowedShells: string[]): string[] {
  const descriptionLines: string[] = [
    `Execute a command in the specified shell (${allowedShells.join(', ')})`,
    "",
    "**IMPORTANT GUIDELINES:**",
    "1. NEVER use chained commands (e.g., 'command1 && command2' or 'command1; command2')",
    "2. ALWAYS use the `workingDir` parameter to specify the working directory",
    "3. NEVER use 'cd' command to change directories",
    "4. Request config of this MCP server configuration using tools",
    "5. Follow limitations taken from configuration",
    "6. Use validate_directories tool to validate directories before execution",
    "",
    "**Best Practices:**",
    "- Specify the full, absolute path in the `workingDir` parameter",
    "- Use the shell's full command for complex operations instead of chaining",
    "- Ensure you have proper permissions for the specified working directory",
    ""
  ];

  // Add examples for each enabled shell
  if (allowedShells.includes('powershell')) {
    descriptionLines.push(
      "Example usage (PowerShell):",
      "```json",
      "{",
      "  \"shell\": \"powershell\",",
      "  \"command\": \"Get-Process | Select-Object -First 5\",",
      "  \"workingDir\": \"C:\\Users\\username\"",
      "}",
      "```",
      ""
    );
  }

  if (allowedShells.includes('cmd')) {
    descriptionLines.push(
      "Example usage (CMD):",
      "```json",
      "{",
      "  \"shell\": \"cmd\",",
      "  \"command\": \"dir /b\",",
      "  \"workingDir\": \"C:\\Projects\"",
      "}",
      "```",
      ""
    );
  }

  if (allowedShells.includes('gitbash')) {
    descriptionLines.push(
      "Example usage (Git Bash):",
      "```json",
      "{",
      "  \"shell\": \"gitbash\",",
      "  \"command\": \"ls -la\",",
      "  \"workingDir\": \"/c/Users/username\"",
      "}",
      "```"
    );
  }

  return descriptionLines;
}
