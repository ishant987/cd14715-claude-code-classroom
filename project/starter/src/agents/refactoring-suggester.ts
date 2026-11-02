import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Refactoring Suggester Subagent
 * Analyzes code structure to identify modernization opportunities,
 * clean code simplifications, and design pattern improvements.
 */
export const refactoringSuggester: AgentDefinition = {
  description: 'Specialized agent that identifies opportunities for refactoring, design pattern application, modern language features, and code simplification.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Skill', 'Read', 'Grep', 'Glob']
};
