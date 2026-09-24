import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Refactoring Suggester Subagent Definition
 * Identifies architectural improvements, design patterns, and modernization opportunities
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies opportunities to modernize code, apply design patterns, decompose complex functions, and remove redundant code.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: [
    'Skill',
    'Read',
    'Grep',
    'Glob',
    'mcp__github__pull_request_read',
    'mcp__github__get_file_contents'
  ]
};
