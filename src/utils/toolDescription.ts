/**
 * Builds the tool description dynamically based on enabled shells
 * @param allowedShells Array of enabled shell names
 * @returns Array of description lines
 */
export function buildToolDescription(allowedShells: string[]): string[] {
  const descriptionLines: string[] = [
    `Execute a command in the specified shell (${allowedShells.join(', ')})`,
    "",
    "Before first usage of windows-cli MCP server with execute_command tool, perform the following actions:",
    "1. Request config of this MCP server configuration using tools",
    "2. Follow limitations taken from configuration",
    "3. Use workingDir parameter for command based on task description",
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
