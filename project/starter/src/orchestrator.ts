import { query, AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/index.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import { RateLimiter, globalRateLimiter } from './utils/rate-limiter.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from './utils/error-handler.js';
import { logger } from './utils/logger.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
  rateLimiter?: RateLimiter;
  timeoutMs?: number;
  maxRetries?: number;
  projectRoot?: string;
}

/**
 * Helper generator for SDK streaming input mode
 */
async function* generateMessages(promptText: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content: promptText },
    parent_tool_use_id: null,
    session_id: `review-orchestrator-${Date.now()}`
  };
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private model: string;
  private maxTurns: number;
  private rateLimiter: RateLimiter;
  private timeoutMs: number;
  private maxRetries: number;
  private projectRoot: string;
  private agents: Record<string, AgentDefinition>;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    this.maxTurns = options.maxTurns ?? 25;
    this.rateLimiter = options.rateLimiter || globalRateLimiter;
    this.timeoutMs = options.timeoutMs ?? 300000; // 5 minutes default
    this.maxRetries = options.maxRetries ?? 3;
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || process.cwd();

    this.agents = {
      'code-quality-analyzer': codeQualityAnalyzer,
      'test-coverage-analyzer': testCoverageAnalyzer,
      'refactoring-suggester': refactoringSuggester
    };
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getModel(): string {
    return this.model;
  }

  getMaxTurns(): number {
    return this.maxTurns;
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
    const startTime = Date.now();
    logger.info(`Starting pull request review for ${owner}/${repo}#${prNumber}`);

    return withTimeout(
      async () => {
        return withRetry(
          async () => {
            await this.rateLimiter.acquire(15000);
            try {
              const orchestratorPrompt = buildOrchestratorPrompt(owner, repo, prNumber);

              let structuredOutputResult: unknown = null;

              for await (const message of query({
                prompt: generateMessages(orchestratorPrompt),
                options: {
                  cwd: this.projectRoot,
                  settingSources: ['project'],
                  mcpServers: mcpServersConfig,
                  model: this.model,
                  allowedTools: [
                    'Task',
                    'Skill',
                    'Read',
                    'Grep',
                    'Glob',
                    'mcp__github__*',
                    'mcp__eslint__*'
                  ],
                  agents: this.agents,
                  maxTurns: this.maxTurns,
                  outputFormat: {
                    type: 'json_schema',
                    schema: ReviewReportJSONSchema
                  }
                }
              })) {
                if (message.type === 'system' && message.subtype === 'init') {
                  logger.debug('MCP Servers initialized:', message.mcp_servers);
                }

                if (message.type === 'assistant') {
                  const content = message.message?.content;
                  if (Array.isArray(content)) {
                    for (const block of content) {
                      if (block.type === 'tool_use') {
                        if (block.name === 'Task') {
                          const input = block.input as { description?: string };
                          logger.info(`Invoking subagent Task: ${input.description || 'Analysis subagent'}`);
                        } else {
                          logger.debug(`Tool used: ${block.name}`);
                        }
                      }
                    }
                  }
                }

                if (message.type === 'result') {
                  if (message.subtype === 'success' && message.structured_output) {
                    structuredOutputResult = message.structured_output;
                  } else if (message.subtype !== 'success') {
                    throw new ReviewError(
                      `Agent execution finished with non-success subtype: ${message.subtype}`,
                      ErrorCodes.AGENT_FAILED
                    );
                  }
                }
              }

              if (!structuredOutputResult) {
                throw new ReviewError(
                  'No structured output received from orchestrator',
                  ErrorCodes.STRUCTURED_OUTPUT_FAILED
                );
              }

              // Validate against ReviewReportSchema
              const validationResult = ReviewReportSchema.safeParse(structuredOutputResult);
              if (!validationResult.success) {
                logger.error('Zod schema validation failed on report output:', validationResult.error.format());
                throw new ReviewError(
                  `Report schema validation failed: ${validationResult.error.message}`,
                  ErrorCodes.VALIDATION_FAILED,
                  { issues: validationResult.error.issues }
                );
              }

              const finalReport = validationResult.data;
              // Ensure metadata reflects real elapsed time if not already set accurately
              finalReport.metadata.duration = Date.now() - startTime;

              logger.info(`Successfully completed review for ${owner}/${repo}#${prNumber} in ${finalReport.metadata.duration}ms`);
              return finalReport;
            } finally {
              this.rateLimiter.release();
            }
          },
          this.maxRetries,
          2000
        );
      },
      this.timeoutMs,
      `Pull request review timed out after ${this.timeoutMs}ms`
    );
  }
}
