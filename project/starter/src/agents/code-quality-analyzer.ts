import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Code Quality Analyzer Subagent Definition
 * Analyzes code for security vulnerabilities, performance issues, maintainability concerns, and linting
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes code for security vulnerabilities, performance issues, maintainability concerns, style violations, and best practices. Integrates Claude Skills and ESLint.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: [
    'Skill',
    'Read',
    'Grep',
    'Glob',
    'mcp__eslint__lint',
    'mcp__github__pull_request_read',
    'mcp__github__get_file_contents'
  ]
};
