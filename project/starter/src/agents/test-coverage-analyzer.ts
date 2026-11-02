import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Test Coverage Analyzer Subagent
 * Analyzes code to evaluate test completeness, identify untested execution paths,
 * and suggest high-priority, concrete test cases with assertions.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Specialized agent that evaluates test coverage, discovers untested critical code paths and edge cases, and suggests specific unit test scenarios with assertions.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Skill', 'Read', 'Grep', 'Glob']
};
