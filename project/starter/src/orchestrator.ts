import { query } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import { mcpServersConfig } from './config/mcp.config.js';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import {
  RateLimiter,
  globalRateLimiter,
  withRateLimit,
  withRetry,
  withTimeout,
  ReviewError,
  ErrorCodes,
  logger
} from './utils/index.js';
import { logReviewStart, logReviewComplete, logReviewError } from './utils/logger.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  rateLimiter?: RateLimiter;
  mcpServers?: Record<string, any>;
  maxTurns?: number;
  cwd?: string;
  timeoutMs?: number;
  maxRetries?: number;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'delegate' | 'dontAsk';
}

/**
 * Async generator for query user message streaming
 */
async function* generateReviewMessages(userPrompt: string, sessionId: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content: userPrompt },
    parent_tool_use_id: null,
    session_id: sessionId
  };
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private options: OrchestratorOptions;
  private rateLimiter: RateLimiter;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      model: process.env.ANTHROPIC_MODEL || options.model,
      maxTurns: 30,
      timeoutMs: 300000, // 5 minutes
      maxRetries: 3,
      ...options
    };
    this.rateLimiter = options.rateLimiter || globalRateLimiter;
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const model = this.options.model || process.env.ANTHROPIC_MODEL;
    if (!model) {
      throw new ReviewError(
        'ANTHROPIC_MODEL environment variable is required',
        ErrorCodes.INVALID_CONFIG
      );
    }

    logReviewStart(owner, repo, prNumber);
    const startTime = Date.now();

    const executeReview = async (): Promise<ReviewReport> => {
      return withRateLimit(
        this.rateLimiter,
        async () => {
          const prompt = buildOrchestratorPrompt(owner, repo, prNumber);
          const sessionId = `code-review-${owner}-${repo}-${prNumber}-${Date.now()}`;
          const projectRoot = this.options.cwd || process.env.PROJECT_ROOT || process.cwd();

          logger.info(`Orchestrator querying subagents for ${owner}/${repo}#${prNumber}`, {
            model,
            projectRoot
          });

          let finalStructuredOutput: unknown = null;

          for await (const message of query({
            prompt: generateReviewMessages(prompt, sessionId),
            options: {
              model,
              cwd: projectRoot,
              settingSources: ['project'],
              mcpServers: this.options.mcpServers || mcpServersConfig,
              allowedTools: [
                'Task',
                'Skill',
                'Read',
                'Grep',
                'Glob',
                'mcp__github__*',
                'mcp__eslint__*'
              ],
              agents: {
                'code-quality-analyzer': codeQualityAnalyzer,
                'test-coverage-analyzer': testCoverageAnalyzer,
                'refactoring-suggester': refactoringSuggester
              },
              outputFormat: {
                type: 'json_schema',
                schema: ReviewReportJSONSchema
              },
              maxTurns: this.options.maxTurns || 30
            }
          })) {
            if (message.type === 'system' && message.subtype === 'init') {
              logger.debug('MCP Servers initialized', {
                mcp_servers: message.mcp_servers
              });
            }

            if (message.type === 'assistant') {
              const content = message.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'tool_use') {
                    logger.debug(`[Tool Call]: ${block.name}`, {
                      tool: block.name,
                      input: block.input
                    });
                  }
                }
              }
            }

            if (message.type === 'result') {
              if (message.subtype === 'success' && message.structured_output) {
                finalStructuredOutput = message.structured_output;
              } else if (
                message.subtype === 'error_max_structured_output_retries'
              ) {
                throw new ReviewError(
                  'Structured output generation failed after max retries',
                  ErrorCodes.STRUCTURED_OUTPUT_FAILED
                );
              }
            }
          }

          if (!finalStructuredOutput) {
            throw new ReviewError(
              'No structured review output was returned by the orchestrator',
              ErrorCodes.STRUCTURED_OUTPUT_FAILED
            );
          }

          const validationResult = ReviewReportSchema.safeParse(finalStructuredOutput);
          if (!validationResult.success) {
            logger.error('ReviewReport schema validation failed', {
              errors: validationResult.error.errors
            });
            throw new ReviewError(
              `Invalid review report schema: ${validationResult.error.message}`,
              ErrorCodes.VALIDATION_FAILED,
              { errors: validationResult.error.errors }
            );
          }

          const duration = Date.now() - startTime;
          const report = validationResult.data;
          report.metadata.duration = duration;

          logReviewComplete(
            owner,
            repo,
            prNumber,
            report.summary.overallScore,
            duration
          );

          return report;
        },
        5000
      );
    };

    try {
      return await withRetry(
        async () => {
          return await withTimeout(
            executeReview,
            this.options.timeoutMs || 300000,
            `Code review operation timed out after ${this.options.timeoutMs || 300000}ms`
          );
        },
        this.options.maxRetries || 3,
        2000
      );
    } catch (error) {
      logReviewError(owner, repo, prNumber, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
