//evals.ts

import { EvalConfig } from 'mcp-evals';
import { openai } from "@ai-sdk/openai";
import { grade, EvalFunction } from "mcp-evals";

const execute_commandEval: EvalFunction = {
    name: "execute_commandEval",
    description: "Evaluates the ability to execute a command in a specified shell",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'execute_command' tool to run 'Get-Process | Select-Object -First 5' in powershell with working dir 'C:\\Users\\username'.");
        return JSON.parse(result);
    }
};

const get_command_historyEval: EvalFunction = {
    name: 'Get Command History Tool Evaluation',
    description: 'Evaluates the tool by requesting a limited command history',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Retrieve the last 5 commands from the command history.");
        return JSON.parse(result);
    }
};

const ssh_executeEval: EvalFunction = {
    name: "ssh_executeEval",
    description: "Tests the SSH command execution functionality",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please use the ssh_execute tool to run 'uname -a' on the raspberry-pi connection.");
        return JSON.parse(result);
    }
};

const ssh_disconnectEval: EvalFunction = {
    name: "ssh_disconnect Tool Evaluation",
    description: "Evaluates the ssh_disconnect tool functionality",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please disconnect the SSH session with the connectionId set to 'raspberry-pi'.");
        return JSON.parse(result);
    }
};

const create_ssh_connectionEval: EvalFunction = {
    name: 'create_ssh_connectionEval',
    description: 'Evaluates the functionality of creating a new SSH connection',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please create a new SSH connection with ID 'conn123' to host 'example.com' on port 22 using username 'admin' and password 'mySecretPass'.");
        return JSON.parse(result);
    }
};

const config: EvalConfig = {
    model: openai("gpt-4"),
    evals: [execute_commandEval, get_command_historyEval, ssh_executeEval, ssh_disconnectEval, create_ssh_connectionEval]
};
  
export default config;
  
export const evals = [execute_commandEval, get_command_historyEval, ssh_executeEval, ssh_disconnectEval, create_ssh_connectionEval];