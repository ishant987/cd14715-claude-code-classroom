import { describe, it, expect, vi } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { ReviewReportSchema } from '../src/types/report-types.js';

describe('CodeReviewOrchestrator', () => {
  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom rate limit configuration and options', () => {
      const customLimiter = new RateLimiter({
        maxRequestsPerMinute: 20,
        maxTokensPerMinute: 50000,
        maxConcurrent: 2
      });

      const orchestrator = new CodeReviewOrchestrator({
        rateLimiter: customLimiter,
        maxTurns: 15,
        timeoutMs: 60000
      });

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  describe('reviewPullRequest validation', () => {
    it('should fail when ANTHROPIC_MODEL is not set', async () => {
      const prevModel = process.env.ANTHROPIC_MODEL;
      delete process.env.ANTHROPIC_MODEL;

      const orchestrator = new CodeReviewOrchestrator({ model: undefined });

      await expect(
        orchestrator.reviewPullRequest('airaamane', 'simple-todo-app', 1)
      ).rejects.toThrow(/ANTHROPIC_MODEL/);

      if (prevModel) {
        process.env.ANTHROPIC_MODEL = prevModel;
      }
    });

    it('should validate structured report schema output structure', () => {
      const sampleValidReport = {
        pullRequest: { owner: 'airaamane', repo: 'simple-todo-app', number: 1 },
        fileReviews: [
          {
            file: 'src/todo.ts',
            codeQuality: {
              file: 'src/todo.ts',
              issues: [],
              overallScore: 90,
              summary: 'Well structured code'
            },
            testCoverage: {
              file: 'src/todo.ts',
              hasTests: true,
              testFiles: ['tests/todo.test.ts'],
              untestedPaths: [],
              coverageEstimate: 88,
              summary: 'Good coverage'
            },
            refactorings: {
              file: 'src/todo.ts',
              suggestions: [],
              summary: 'No refactorings needed'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 90,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [
          {
            priority: 'medium' as const,
            category: 'Testing',
            description: 'Add tests for edge cases',
            files: ['src/todo.ts']
          }
        ],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 2500,
          agentVersions: {
            'code-quality-analyzer': '1.0.0',
            'test-coverage-analyzer': '1.0.0',
            'refactoring-suggester': '1.0.0'
          }
        }
      };

      const parsed = ReviewReportSchema.safeParse(sampleValidReport);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Integration', () => {
    // Integration tests with live API key can be run when credentials are provided
    it.skip('should review a real PR when live credentials exist', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const result = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      expect(result).toBeDefined();
    });
  });
});
