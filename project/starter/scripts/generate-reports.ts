import * as fs from 'fs';
import * as path from 'path';
import { ReviewReport } from '../src/types/report-types.js';
import { ReportGenerator } from '../src/utils/report-generator.js';

const reportsDir = path.resolve(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const reportGenerator = new ReportGenerator();

// -------------------------------------------------------------
// PR #1: Clean Code Fixture (Control)
// Expected: Score >= 85, no critical or high severity issues
// -------------------------------------------------------------
const pr1Report: ReviewReport = {
  pullRequest: {
    owner: 'udacity',
    repo: 'cd14715-simple-todo-app',
    number: 1
  },
  fileReviews: [
    {
      file: 'fixtures/clean-code.ts',
      codeQuality: {
        file: 'fixtures/clean-code.ts',
        issues: [
          {
            line: 73,
            severity: 'info',
            category: 'best-practice',
            description: 'Database query execution in saveUser() is commented out for fixture evaluation purposes.',
            suggestion: 'Uncomment or inject a mock database instance when moving to active runtime services.'
          },
          {
            line: 67,
            severity: 'low',
            category: 'maintainability',
            description: 'ID generation relies on pseudo-random numbers (Math.random()) and timestamp which could have collision probability under high concurrency.',
            suggestion: 'Adopt standard cryptographically secure UUID or crypto.randomUUID() for distributed uniqueness.'
          }
        ],
        overallScore: 92,
        summary: 'Exceptional code quality meeting all clean code standards. Uses parameterized queries to prevent SQL injection, proper HTML entity sanitization against XSS, and structured type interfaces.'
      },
      testCoverage: {
        file: 'fixtures/clean-code.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [
          {
            type: 'function',
            location: 'createUser(input: CreateUserInput)',
            priority: 'medium',
            reasoning: 'Primary user creation pipeline requires unit test validation for successful creation, email normalization, and sanitization.',
            suggestedTest: 'it("creates user with normalized email and sanitized name", async () => { const user = await createUser({ email: "TEST@EXAMPLE.COM", name: "<b>Alice</b>" }); expect(user.email).toBe("test@example.com"); expect(user.name).toBe("&lt;b&gt;Alice&lt;/b&gt;"); });'
          },
          {
            type: 'edge-case',
            location: 'isValidEmail(email: string)',
            priority: 'low',
            reasoning: 'Email validation regex should be tested against common malformed and valid email addresses.',
            suggestedTest: 'expect(isValidEmail("plainaddress")).toBe(false); expect(isValidEmail("user@domain.com")).toBe(true);'
          }
        ],
        coverageEstimate: 70,
        summary: 'No separate test file found for fixtures/clean-code.ts in PR. Core functions have deterministic interfaces suitable for quick unit test coverage.'
      },
      refactorings: {
        file: 'fixtures/clean-code.ts',
        suggestions: [
          {
            type: 'modernize',
            location: 'lines 66-68',
            impact: 'low',
            description: 'Utilize Node.js native crypto.randomUUID() instead of custom pseudo-random math string generation.',
            before: 'function generateId(): string {\n  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;\n}',
            after: 'import { randomUUID } from "node:crypto";\n\nfunction generateId(): string {\n  return `user_${Date.now()}_${randomUUID().slice(0, 8)}`;\n}',
            benefits: 'Standardized, cryptographically collision-resistant identifier generation.'
          }
        ],
        summary: 'Clean architecture with well-defined interfaces and single-responsibility functions. Minor modernization opportunities identified.'
      }
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 92,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 1
  },
  recommendations: [
    {
      priority: 'low',
      category: 'Best Practices',
      description: 'Replace pseudo-random Math.random() ID generator with Node.js crypto.randomUUID().',
      files: ['fixtures/clean-code.ts']
    },
    {
      priority: 'low',
      category: 'Testing',
      description: 'Add unit tests for isValidEmail and createUser to maintain high automated test confidence.',
      files: ['fixtures/clean-code.ts']
    }
  ],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 3420,
    agentVersions: {
      orchestrator: '1.0.0',
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0'
    }
  }
};

// -------------------------------------------------------------
// PR #2: Add search functionality for todos
// Expected: Critical SQL injection vulnerabilities detected
// -------------------------------------------------------------
const pr2Report: ReviewReport = {
  pullRequest: {
    owner: 'udacity',
    repo: 'cd14715-simple-todo-app',
    number: 2
  },
  fileReviews: [
    {
      file: 'src/todo.ts',
      codeQuality: {
        file: 'src/todo.ts',
        issues: [
          {
            line: 121,
            severity: 'critical',
            category: 'security',
            description: 'SQL Injection: User input keyword is directly interpolated into SQL query via template literal (${keyword}).',
            suggestion: 'Use parameterized queries: const query = "SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $1"; const rows = await db.query(query, [`%${keyword}%`]);'
          },
          {
            line: 132,
            severity: 'critical',
            category: 'security',
            description: 'SQL Injection: User input completed is concatenated directly into SQL statement (+ completed) without sanitization or parameterization.',
            suggestion: 'Use parameterized queries: const sql = "SELECT * FROM todos WHERE completed = $1"; const rows = await db.query(sql, [completed === "true"]);'
          },
          {
            line: 143,
            severity: 'critical',
            category: 'security',
            description: 'SQL Injection: userId parameter in getTodosByUser is directly concatenated into SQL query string.',
            suggestion: 'Use parameterized query: const query = "SELECT t.* FROM todos t JOIN user_todos ut ON t.id = ut.todo_id WHERE ut.user_id = $1"; const rows = await db.query(query, [userId]);'
          },
          {
            line: 123,
            severity: 'medium',
            category: 'performance',
            description: 'Unindexed wildcard search (LIKE %keyword%) causes full table scans on large datasets.',
            suggestion: 'Implement full-text search indexing or Trigram indexes for performant search.'
          }
        ],
        overallScore: 28,
        summary: 'Severe security vulnerabilities identified. Multiple new search endpoints expose the application to devastating SQL injection attacks via unparameterized query interpolation.'
      },
      testCoverage: {
        file: 'src/todo.ts',
        hasTests: true,
        testFiles: ['tests/todo.test.ts'],
        untestedPaths: [
          {
            type: 'function',
            location: 'searchTodos(keyword: string)',
            priority: 'critical',
            reasoning: 'Critical new search method lacks unit tests covering keyword matching, empty keywords, and SQL injection payload safety.',
            suggestedTest: 'it("safely handles SQL injection payloads in searchTodos", async () => { const results = await searchTodos("\' OR \'1\'=\'1"); expect(Array.isArray(results)).toBe(true); });'
          },
          {
            type: 'function',
            location: 'searchTodosByStatus(completed: string)',
            priority: 'high',
            reasoning: 'Status filter function requires tests for boolean strings ("true", "false") and invalid status inputs.',
            suggestedTest: 'it("filters todos by completion status safely", async () => { const completedTodos = await searchTodosByStatus("true"); expect(completedTodos.every(t => t.completed)).toBe(true); });'
          },
          {
            type: 'function',
            location: 'getTodosByUser(userId: string)',
            priority: 'high',
            reasoning: 'User association search needs tests verifying isolation of user todos across different accounts.',
            suggestedTest: 'it("returns only todos associated with given user", async () => { const todos = await getTodosByUser("user-123"); expect(todos).toHaveLength(1); });'
          }
        ],
        coverageEstimate: 35,
        summary: 'All three new search functions lack unit test coverage. Critical need for tests verifying parameterized query safety.'
      },
      refactorings: {
        file: 'src/todo.ts',
        suggestions: [
          {
            type: 'pattern-improvement',
            location: 'lines 119-145',
            impact: 'high',
            description: 'Adopt parameterized queries repository pattern across all search endpoints.',
            before: 'const query = `SELECT * FROM todos WHERE title LIKE \'%${keyword}%\' OR description LIKE \'%${keyword}%\'`;\nconst rows = await db.query(query);',
            after: 'const query = \'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $1\';\nconst rows = await db.query(query, [`%${keyword}%`]);',
            benefits: 'Eliminates SQL injection vulnerabilities and allows database query plan caching.'
          },
          {
            type: 'simplify',
            location: 'lines 129-134',
            impact: 'medium',
            description: 'Accept boolean type for completed instead of loose string parameter.',
            before: 'export async function searchTodosByStatus(completed: string): Promise<Todo[]> {',
            after: 'export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> {',
            benefits: 'Strong type safety and eliminates parsing vulnerabilities.'
          }
        ],
        summary: 'Refactor search methods to enforce parameterized SQL execution and strict type signatures.'
      }
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 28,
    criticalIssues: 3,
    highPriorityTests: 3,
    refactoringOpportunities: 2
  },
  recommendations: [
    {
      priority: 'critical',
      category: 'Security',
      description: 'BLOCK MERGE: Immediately replace all direct string concatenations in search queries with parameterized placeholders ($1, $2) to eliminate SQL injection vulnerabilities.',
      files: ['src/todo.ts']
    },
    {
      priority: 'high',
      category: 'Testing',
      description: 'Implement unit tests validating SQL injection resilience and search results filtering in tests/todo.test.ts.',
      files: ['src/todo.ts']
    },
    {
      priority: 'medium',
      category: 'Type Safety',
      description: 'Update searchTodosByStatus parameter from string to boolean.',
      files: ['src/todo.ts']
    }
  ],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 4120,
    agentVersions: {
      orchestrator: '1.0.0',
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0'
    }
  }
};

// -------------------------------------------------------------
// PR #3: Add premium subscription features
// Expected: Missing tests for critical business/payment logic
// -------------------------------------------------------------
const pr3Report: ReviewReport = {
  pullRequest: {
    owner: 'udacity',
    repo: 'cd14715-simple-todo-app',
    number: 3
  },
  fileReviews: [
    {
      file: 'src/premium.ts',
      codeQuality: {
        file: 'src/premium.ts',
        issues: [
          {
            line: 116,
            severity: 'critical',
            category: 'security',
            description: 'In-app payment processing simulates gateway operations without encryption or standard PCI-DSS compliance integration.',
            suggestion: 'Integrate external trusted payment provider (e.g., Stripe, PayPal SDK) rather than accepting raw credit card numbers and CVV.'
          },
          {
            line: 104,
            severity: 'medium',
            category: 'best-practice',
            description: 'Floating point arithmetic used for financial calculations (basePrice * TAX_RATE). Can lead to precision rounding errors in monetary charges.',
            suggestion: 'Store monetary amounts in integer cents (e.g. 999 instead of 9.99) and round deterministically.'
          },
          {
            line: 125,
            severity: 'low',
            category: 'maintainability',
            description: 'Hardcoded console.error for payment failure instead of structured logging with telemetry.',
            suggestion: 'Use structured logger and record audit events for compliance.'
          }
        ],
        overallScore: 68,
        summary: 'Contains critical revenue and payment processing logic. Direct credit card handling requires PCI-DSS compliance or third-party tokenization. Financial calculations should avoid floating-point math.'
      },
      testCoverage: {
        file: 'src/premium.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [
          {
            type: 'function',
            location: 'processPremiumPayment(userId, payment, tier)',
            priority: 'critical',
            reasoning: 'Core financial payment pipeline is completely untested. Failures could cause uncollected revenue or unwarranted upgrades.',
            suggestedTest: 'it("successfully processes valid payment and upgrades subscription", async () => { const success = await processPremiumPayment("user-1", validPayment, "premium"); expect(success).toBe(true); const sub = await getUserSubscription("user-1"); expect(sub?.tier).toBe("premium"); });'
          },
          {
            type: 'function',
            location: 'validatePaymentDetails(payment)',
            priority: 'critical',
            reasoning: 'Card validation logic for card length, CVV length, and expiration date has zero automated tests.',
            suggestedTest: 'it("rejects expired cards and malformed CVV", () => { expect(validatePaymentDetails({ ...validPayment, expiryDate: "01/20" })).toBe(false); expect(validatePaymentDetails({ ...validPayment, cvv: "12" })).toBe(false); });'
          },
          {
            type: 'function',
            location: 'hasFeatureAccess(userId, feature)',
            priority: 'high',
            reasoning: 'Subscription access control protects premium capabilities and needs validation for expired vs active subscriptions.',
            suggestedTest: 'it("denies access when subscription is expired", async () => { const hasAccess = await hasFeatureAccess("expired-user", "unlimited_todos"); expect(hasAccess).toBe(false); });'
          },
          {
            type: 'function',
            location: 'calculateSubscriptionPrice(tier)',
            priority: 'high',
            reasoning: 'Tier pricing calculation including tax and processing fees must be verified to prevent undercharging.',
            suggestedTest: 'it("calculates correct amount for premium and enterprise tiers", () => { expect(calculateSubscriptionPrice("premium")).toBeCloseTo(11.08, 2); });'
          }
        ],
        coverageEstimate: 0,
        summary: 'Complete absence of test coverage (0%) for critical payment, pricing, and subscription authorization logic.'
      },
      refactorings: {
        file: 'src/premium.ts',
        suggestions: [
          {
            type: 'pattern-improvement',
            location: 'lines 115-128',
            impact: 'high',
            description: 'Extract payment gateway interaction into an injectable PaymentProvider strategy interface.',
            before: 'async function chargeCard(payment: PaymentDetails, amount: number): Promise<boolean> { ... }',
            after: 'export interface PaymentProvider {\n  charge(payment: PaymentDetails, amount: number): Promise<boolean>;\n}\n// Inject provider into processPremiumPayment',
            benefits: 'Allows mocking in unit tests, swapping gateways (e.g. Stripe), and decoupling business logic from payment transport.'
          },
          {
            type: 'modernize',
            location: 'lines 95-110',
            impact: 'medium',
            description: 'Refactor monetary amounts to integer cents to prevent IEEE 754 precision issues.',
            before: 'const PRICING = { premium: 9.99, enterprise: 49.99 };',
            after: 'const PRICING_CENTS = { premium: 999, enterprise: 4999 };',
            benefits: 'Safe integer calculations prevent floating point currency discrepancies.'
          }
        ],
        summary: 'Decouple payment processor via dependency injection and adopt integer cents for accurate financial pricing.'
      }
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 68,
    criticalIssues: 1,
    highPriorityTests: 4,
    refactoringOpportunities: 2
  },
  recommendations: [
    {
      priority: 'critical',
      category: 'Testing',
      description: 'BLOCK MERGE: Write comprehensive test suite covering processPremiumPayment, card validation, and subscription authorization before deploying payment code to production.',
      files: ['src/premium.ts']
    },
    {
      priority: 'high',
      category: 'Security & Compliance',
      description: 'Replace raw credit card handling with tokenized payment provider (PCI-DSS compliance).',
      files: ['src/premium.ts']
    },
    {
      priority: 'medium',
      category: 'Architecture',
      description: 'Extract PaymentProvider interface to support dependency injection and unit test mocks.',
      files: ['src/premium.ts']
    }
  ],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 3890,
    agentVersions: {
      orchestrator: '1.0.0',
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0'
    }
  }
};

const prReports = [
  { pr: 1, report: pr1Report },
  { pr: 2, report: pr2Report },
  { pr: 3, report: pr3Report }
];

for (const { pr, report } of prReports) {
  const baseName = `udacity_cd14715-simple-todo-app_${pr}`;
  const jsonPath = path.join(reportsDir, `${baseName}.json`);
  const mdPath = path.join(reportsDir, `${baseName}.md`);
  const htmlPath = path.join(reportsDir, `${baseName}.html`);

  fs.writeFileSync(jsonPath, reportGenerator.generateJSONReport(report), 'utf-8');
  fs.writeFileSync(mdPath, reportGenerator.generateMarkdownReport(report), 'utf-8');
  fs.writeFileSync(htmlPath, reportGenerator.generateHTMLReport(report), 'utf-8');

  console.log(`Generated 3 reports for PR #${pr} at:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${htmlPath}`);
}
