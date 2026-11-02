import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Code Quality Analyzer Subagent
 * Analyzes source code for security vulnerabilities, performance bottlenecks,
 * maintainability concerns, and adherence to language best practices.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description: 'Specialized agent that analyzes code files for security vulnerabilities, performance issues, code smells, and best practice violations using Claude Skills and linting tools.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Skill', 'Read', 'Grep', 'Glob', 'mcp__eslint__*']
};
