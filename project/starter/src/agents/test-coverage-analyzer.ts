import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Test Coverage Analyzer Subagent Definition
 * Identifies functions/methods without test coverage and suggests actionable test cases
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Identifies untested functions, branches, edge cases, estimates test coverage, and suggests specific test cases with assertions.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
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
