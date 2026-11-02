import { describe, it, expect } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('CodeReviewOrchestrator', () => {
  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getMaxTurns()).toBe(25);
      expect(orchestrator.getModel()).toBeDefined();
    });

    it('should accept custom rate limit configuration', () => {
      const customLimiter = new RateLimiter({
        maxRequestsPerMinute: 20,
        maxTokensPerMinute: 50000,
        maxConcurrent: 2
      });

      const orchestrator = new CodeReviewOrchestrator({
        rateLimiter: customLimiter,
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 15
      });

      expect(orchestrator.getRateLimiter()).toBe(customLimiter);
      expect(orchestrator.getModel()).toBe('claude-haiku-4-5-20251001');
      expect(orchestrator.getMaxTurns()).toBe(15);
    });
  });

  describe('Integration', () => {
    // Requires live API credentials, skipped in offline/CI unit tests
    it.skip('should review a real small PR', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      expect(report).toBeDefined();
      expect(report.pullRequest.owner).toBe('octocat');
    });
  });
});
