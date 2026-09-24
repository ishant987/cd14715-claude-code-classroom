import { describe, it, expect } from 'vitest';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema
} from '../src/types/analysis-results.js';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema
} from '../src/types/report-types.js';
import {
  withRetry,
  withTimeout,
  ReviewError,
  ErrorCodes,
  formatError
} from '../src/utils/error-handler.js';
import {
  RateLimiter,
  withRateLimit
} from '../src/utils/rate-limiter.js';

describe('Schema Validation Tests', () => {
  describe('CodeQualityResultSchema', () => {
    it('should validate correct code quality results', () => {
      const validData = {
        file: 'src/todo.ts',
        issues: [
          {
            line: 42,
            severity: 'high' as const,
            category: 'security' as const,
            description: 'Potential SQL injection vulnerability',
            suggestion: 'Use parameterized queries instead of string concatenation'
          }
        ],
        overallScore: 85,
        summary: 'Good overall quality with one security issue to fix.'
      };

      const result = CodeQualityResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid severity or category enums', () => {
      const invalidData = {
        file: 'src/todo.ts',
        issues: [
          {
            line: 10,
            severity: 'invalid-severity',
            category: 'unknown-category',
            description: 'test',
            suggestion: 'fix'
          }
        ],
        overallScore: 90,
        summary: 'test'
      };

      const result = CodeQualityResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle edge cases (empty issues, boundary scores 0 and 100)', () => {
      const minScore = {
        file: 'src/broken.ts',
        issues: [],
        overallScore: 0,
        summary: 'Completely broken file'
      };
      const maxScore = {
        file: 'src/perfect.ts',
        issues: [],
        overallScore: 100,
        summary: 'Flawless file'
      };
      const outOfBoundsScore = {
        file: 'src/test.ts',
        issues: [],
        overallScore: 101,
        summary: 'Out of bounds'
      };

      expect(CodeQualityResultSchema.safeParse(minScore).success).toBe(true);
      expect(CodeQualityResultSchema.safeParse(maxScore).success).toBe(true);
      expect(CodeQualityResultSchema.safeParse(outOfBoundsScore).success).toBe(false);
    });
  });

  describe('TestCoverageResultSchema', () => {
    it('should validate correct test coverage results', () => {
      const validData = {
        file: 'src/services/auth.ts',
        hasTests: true,
        testFiles: ['tests/services/auth.test.ts'],
        untestedPaths: [
          {
            type: 'branch' as const,
            location: 'handleTokenRefresh:line 35',
            priority: 'critical' as const,
            reasoning: 'Critical authentication refresh path must be verified for expiration behavior',
            suggestedTest: 'it("should reject expired refresh token", async () => { ... })'
          }
        ],
        coverageEstimate: 78,
        summary: 'Solid coverage on happy paths, needs edge case tests for token expiration.'
      };

      const result = TestCoverageResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        file: 'src/test.ts',
        hasTests: true
        // missing testFiles, untestedPaths, coverageEstimate, summary
      };

      expect(TestCoverageResultSchema.safeParse(invalidData).success).toBe(false);
    });
  });

  describe('RefactoringSuggestionSchema', () => {
    it('should validate correct refactoring suggestions', () => {
      const validData = {
        file: 'src/utils/parser.ts',
        suggestions: [
          {
            type: 'extract-function' as const,
            location: 'parseQueryString:lines 20-50',
            impact: 'medium' as const,
            description: 'Extract nested query parameter decoder to a dedicated helper function',
            before: 'for (const pair of pairs) { ... 30 lines ... }',
            after: 'const decoded = decodeParamPair(pair);',
            benefits: 'Reduces cyclomatic complexity and simplifies unit testing'
          }
        ],
        summary: 'Found 1 high-value refactoring opportunity.'
      };

      expect(RefactoringSuggestionSchema.safeParse(validData).success).toBe(true);
    });
  });

  describe('ReviewReportSchema & JSON Schema Export', () => {
    it('should validate complete unified review report', () => {
      const completeReport = {
        pullRequest: {
          owner: 'airaamane',
          repo: 'simple-todo-app',
          number: 1
        },
        fileReviews: [
          {
            file: 'src/todo.ts',
            codeQuality: {
              file: 'src/todo.ts',
              issues: [],
              overallScore: 95,
              summary: 'Clean implementation.'
            },
            testCoverage: {
              file: 'src/todo.ts',
              hasTests: true,
              testFiles: ['tests/todo.test.ts'],
              untestedPaths: [],
              coverageEstimate: 92,
              summary: 'Comprehensive test coverage.'
            },
            refactorings: {
              file: 'src/todo.ts',
              suggestions: [],
              summary: 'No refactoring required.'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 94,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [
          {
            priority: 'low' as const,
            category: 'Maintainability',
            description: 'Add inline documentation comments for public API exports',
            files: ['src/todo.ts']
          }
        ],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 3500,
          agentVersions: {
            'code-quality-analyzer': '1.0.0',
            'test-coverage-analyzer': '1.0.0',
            'refactoring-suggester': '1.0.0'
          }
        }
      };

      const result = ReviewReportSchema.safeParse(completeReport);
      expect(result.success).toBe(true);
    });

    it('should have valid JSON Schema objects exported for SDK structured outputs', () => {
      expect(typeof CodeQualityResultJSONSchema).toBe('object');
      expect(typeof TestCoverageResultJSONSchema).toBe('object');
      expect(typeof RefactoringSuggestionJSONSchema).toBe('object');
      expect(typeof ReviewReportJSONSchema).toBe('object');
      expect(ReviewReportJSONSchema).toHaveProperty('type', 'object');
      expect(ReviewReportJSONSchema).toHaveProperty('properties');
    });
  });
});

describe('Production Utilities Tests', () => {
  describe('Error Handler withRetry & withTimeout', () => {
    it('withRetry should succeed on first try if function passes', async () => {
      let attempts = 0;
      const result = await withRetry(async () => {
        attempts++;
        return 'success';
      }, 3, 10);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('withRetry should retry failed operations and succeed when resolved', async () => {
      let attempts = 0;
      const result = await withRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'recovered';
      }, 3, 10);

      expect(result).toBe('recovered');
      expect(attempts).toBe(2);
    });

    it('withRetry should throw ReviewError with RETRY_EXHAUSTED if max retries exceeded', async () => {
      let attempts = 0;
      await expect(
        withRetry(async () => {
          attempts++;
          throw new Error('Persistent failure');
        }, 3, 10)
      ).rejects.toThrowError(ReviewError);

      expect(attempts).toBe(3);
    });

    it('withTimeout should resolve if function finishes before timeout', async () => {
      const result = await withTimeout(async () => {
        return 42;
      }, 500);

      expect(result).toBe(42);
    });

    it('withTimeout should reject with AGENT_TIMEOUT if operation exceeds duration', async () => {
      await expect(
        withTimeout(async () => {
          await new Promise((r) => setTimeout(r, 200));
          return 'late';
        }, 50)
      ).rejects.toThrowError(ReviewError);
    });

    it('formatError should format ReviewError and standard errors appropriately', () => {
      const reviewErr = new ReviewError('Not found', ErrorCodes.PR_NOT_FOUND);
      expect(formatError(reviewErr)).toContain(`[${ErrorCodes.PR_NOT_FOUND}] Not found`);

      const stdErr = new Error('Regular error');
      expect(formatError(stdErr)).toBe('Regular error');
    });
  });

  describe('RateLimiter sliding window and concurrency', () => {
    it('should allow requests within rate limits', () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 10000,
        maxConcurrent: 2
      });

      expect(limiter.canProceed(500)).toBe(true);
    });

    it('acquire and release should track active requests and history', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 5,
        maxTokensPerMinute: 5000,
        maxConcurrent: 2
      });

      await limiter.acquire(100);
      const status = limiter.getStatus();
      expect(status.activeRequests).toBe(1);
      expect(status.requestsInWindow).toBe(1);

      limiter.release(120);
      const updatedStatus = limiter.getStatus();
      expect(updatedStatus.activeRequests).toBe(0);
      expect(updatedStatus.tokensInWindow).toBe(120);
    });

    it('withRateLimit should execute and automatically release slot on success and error', async () => {
      const limiter = new RateLimiter();
      const res = await withRateLimit(limiter, async () => 'done', 50);
      expect(res).toBe('done');
      expect(limiter.getStatus().activeRequests).toBe(0);

      await expect(
        withRateLimit(
          limiter,
          async () => {
            throw new Error('fail');
          },
          50
        )
      ).rejects.toThrow();
      expect(limiter.getStatus().activeRequests).toBe(0);
    });
  });
});
