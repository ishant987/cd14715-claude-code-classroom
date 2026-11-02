import { describe, it, expect } from 'vitest';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema,
  ReviewReportSchema,
  ReviewReportJSONSchema
} from '../src/types/index.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from '../src/utils/error-handler.js';

describe('Zod Schema Validation Tests', () => {
  describe('CodeQualityResultSchema', () => {
    it('accepts valid code quality data', () => {
      const validData = {
        file: 'src/index.ts',
        issues: [
          {
            line: 42,
            severity: 'high' as const,
            category: 'security' as const,
            description: 'Potential SQL injection',
            suggestion: 'Use parameterized queries'
          }
        ],
        overallScore: 85,
        summary: 'Good code quality with one security issue'
      };

      const result = CodeQualityResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.overallScore).toBe(85);
        expect(result.data.issues).toHaveLength(1);
      }
    });

    it('rejects invalid severity and out-of-range scores', () => {
      const invalidData = {
        file: 'src/index.ts',
        issues: [
          {
            line: 42,
            severity: 'invalid-severity',
            category: 'security',
            description: 'Issue',
            suggestion: 'Fix'
          }
        ],
        overallScore: 150, // exceeds max 100
        summary: 'Invalid'
      };

      const result = CodeQualityResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('handles edge cases: empty issues array and boundary scores 0 and 100', () => {
      const scoreZero = {
        file: 'src/empty.ts',
        issues: [],
        overallScore: 0,
        summary: 'Zero score'
      };
      const scoreHundred = {
        file: 'src/perfect.ts',
        issues: [],
        overallScore: 100,
        summary: 'Perfect score'
      };

      expect(CodeQualityResultSchema.safeParse(scoreZero).success).toBe(true);
      expect(CodeQualityResultSchema.safeParse(scoreHundred).success).toBe(true);
    });
  });

  describe('TestCoverageResultSchema', () => {
    it('accepts valid test coverage data', () => {
      const validData = {
        file: 'src/service.ts',
        hasTests: true,
        testFiles: ['tests/service.test.ts'],
        untestedPaths: [
          {
            type: 'function' as const,
            location: 'handleError()',
            priority: 'critical' as const,
            reasoning: 'Critical error handling logic is not tested',
            suggestedTest: 'expect(() => handleError(null)).toThrow()'
          }
        ],
        coverageEstimate: 75,
        summary: 'Needs error case tests'
      };

      const result = TestCoverageResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const invalidData = {
        file: 'src/service.ts',
        hasTests: true
        // missing testFiles, untestedPaths, coverageEstimate, summary
      };

      const result = TestCoverageResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('RefactoringSuggestionSchema', () => {
    it('accepts valid refactoring suggestions', () => {
      const validData = {
        file: 'src/legacy.ts',
        suggestions: [
          {
            type: 'modernize' as const,
            location: 'lines 10-25',
            impact: 'high' as const,
            description: 'Convert callback hell to async/await',
            before: 'fs.readFile(path, (err, data) => {})',
            after: 'const data = await fs.promises.readFile(path);',
            benefits: 'Improved readability and exception handling'
          }
        ],
        summary: 'Modernize async patterns'
      };

      const result = RefactoringSuggestionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid refactoring type', () => {
      const invalidData = {
        file: 'src/legacy.ts',
        suggestions: [
          {
            type: 'invalid-refactor-type',
            location: 'lines 1-10',
            impact: 'low',
            description: 'test',
            before: '',
            after: '',
            benefits: ''
          }
        ],
        summary: 'invalid'
      };

      const result = RefactoringSuggestionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ReviewReportSchema', () => {
    it('accepts a fully populated unified ReviewReport', () => {
      const fullReport = {
        pullRequest: {
          owner: 'udacity',
          repo: 'cd14715-simple-todo-app',
          number: 1
        },
        fileReviews: [
          {
            file: 'src/todo.js',
            codeQuality: {
              file: 'src/todo.js',
              issues: [],
              overallScore: 95,
              summary: 'Clean code'
            },
            testCoverage: {
              file: 'src/todo.js',
              hasTests: true,
              testFiles: ['tests/todo.test.js'],
              untestedPaths: [],
              coverageEstimate: 90,
              summary: 'Well covered'
            },
            refactorings: {
              file: 'src/todo.js',
              suggestions: [],
              summary: 'No refactorings needed'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 95,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [
          {
            priority: 'low' as const,
            category: 'Testing',
            description: 'Maintain high test coverage',
            files: ['src/todo.js']
          }
        ],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 1200,
          agentVersions: {
            orchestrator: '1.0.0',
            'code-quality-analyzer': '1.0.0'
          }
        }
      };

      const result = ReviewReportSchema.safeParse(fullReport);
      expect(result.success).toBe(true);
    });
  });

  describe('JSON Schema Exports for Agent SDK', () => {
    it('verifies structured outputs JSON schemas exist and have schema properties', () => {
      expect(CodeQualityResultJSONSchema).toBeDefined();
      expect(TestCoverageResultJSONSchema).toBeDefined();
      expect(RefactoringSuggestionJSONSchema).toBeDefined();
      expect(ReviewReportJSONSchema).toBeDefined();

      expect(typeof ReviewReportJSONSchema).toBe('object');
      expect((ReviewReportJSONSchema as any).properties).toBeDefined();
      expect((ReviewReportJSONSchema as any).properties.pullRequest).toBeDefined();
      expect((ReviewReportJSONSchema as any).properties.fileReviews).toBeDefined();
    });
  });
});

describe('Production Utilities Unit Tests', () => {
  describe('Error Handler withRetry', () => {
    it('returns result when function succeeds on first attempt', async () => {
      const fn = async () => 'success';
      const result = await withRetry(fn, 3, 10);
      expect(result).toBe('success');
    });

    it('retries and succeeds on subsequent attempt', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'recovered';
      };

      const result = await withRetry(fn, 3, 10);
      expect(result).toBe('recovered');
      expect(attempts).toBe(2);
    });

    it('throws ReviewError with RETRY_EXHAUSTED when retries are exhausted', async () => {
      const fn = async () => {
        throw new Error('Persistent failure');
      };

      await expect(withRetry(fn, 2, 10)).rejects.toThrowError(ReviewError);
      try {
        await withRetry(fn, 2, 10);
      } catch (err) {
        if (err instanceof ReviewError) {
          expect(err.code).toBe(ErrorCodes.RETRY_EXHAUSTED);
        }
      }
    });
  });

  describe('Error Handler withTimeout', () => {
    it('returns result if execution finishes before timeout', async () => {
      const fastFn = async () => 'quick';
      const result = await withTimeout(fastFn, 500);
      expect(result).toBe('quick');
    });

    it('throws AGENT_TIMEOUT error when operation takes too long', async () => {
      const slowFn = () => new Promise<string>(resolve => setTimeout(() => resolve('done'), 300));
      await expect(withTimeout(slowFn, 50)).rejects.toThrowError(ReviewError);
      try {
        await withTimeout(slowFn, 50);
      } catch (err) {
        if (err instanceof ReviewError) {
          expect(err.code).toBe(ErrorCodes.AGENT_TIMEOUT);
        }
      }
    });
  });

  describe('Rate Limiter', () => {
    it('allows requests when within rate limits', () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 50000,
        maxConcurrent: 2
      });

      expect(limiter.canProceed(1000)).toBe(true);
      const status = limiter.getStatus();
      expect(status.activeRequests).toBe(0);
      expect(status.availableRequests).toBe(10);
    });

    it('manages concurrent requests and slot releases', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 50000,
        maxConcurrent: 1
      });

      await limiter.acquire(500);
      expect(limiter.canProceed(500)).toBe(false);

      limiter.release();
      expect(limiter.canProceed(500)).toBe(true);
    });
  });
});
