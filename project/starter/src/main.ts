import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError, isReviewError } from './utils/error-handler.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const args = process.argv.slice(2);
  const [owner, repo, prStr] = args;

  // 1. Validate command-line arguments
  if (!owner || !repo || !prStr) {
    console.error('❌ Error: Missing required command-line arguments.');
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- airaamane simple-todo-app 1');
    process.exit(1);
  }

  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    console.error(`❌ Error: PR number must be a positive integer, received: "${prStr}"`);
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    process.exit(1);
  }

  // 2. Validate authentication (Anthropic API or AWS Bedrock)
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasBedrockCredentials = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );

  if (hasBedrockCredentials) {
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error('❌ Error: Authentication required. Please configure one of:');
    console.error('  - Anthropic API: ANTHROPIC_API_KEY');
    console.error('  - AWS Bedrock: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION');
    console.error('Check your .env file or environment variables.');
    process.exit(1);
  }

  // 3. Validate ANTHROPIC_MODEL
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    console.error('❌ Error: ANTHROPIC_MODEL environment variable is required.');
    console.error('Examples:');
    console.error('  - Anthropic API: ANTHROPIC_MODEL=claude-sonnet-4-5-20250929');
    console.error('  - AWS Bedrock: ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    process.exit(1);
  }

  console.log(`🚀 Starting multi-agent code review for ${owner}/${repo}#${prNumber}...`);
  console.log(`🤖 Model: ${model}`);

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // 4. Generate Reports in 3 formats (JSON, Markdown, HTML)
    const reportGenerator = new ReportGenerator();
    const reportsDir = path.resolve(process.cwd(), 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const baseName = `${owner}_${repo}_${prNumber}`;
    const jsonPath = path.join(reportsDir, `${baseName}.json`);
    const mdPath = path.join(reportsDir, `${baseName}.md`);
    const htmlPath = path.join(reportsDir, `${baseName}.html`);

    fs.writeFileSync(jsonPath, reportGenerator.generateJSONReport(report), 'utf-8');
    fs.writeFileSync(mdPath, reportGenerator.generateMarkdownReport(report), 'utf-8');
    fs.writeFileSync(htmlPath, reportGenerator.generateHTMLReport(report), 'utf-8');

    console.log('\n========================================');
    console.log('🎉 Code Review Completed Successfully!');
    console.log('========================================');
    console.log(`Overall Score: ${report.summary.overallScore}/100`);
    console.log(`Files Reviewed: ${report.summary.totalFiles}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`High Priority Tests: ${report.summary.highPriorityTests}`);
    console.log(`Refactoring Opportunities: ${report.summary.refactoringOpportunities}`);
    console.log('\nGenerated Reports:');
    console.log(`  📄 JSON:     ${jsonPath}`);
    console.log(`  📝 Markdown: ${mdPath}`);
    console.log(`  🌐 HTML:     ${htmlPath}`);
    console.log('========================================\n');
  } catch (error) {
    const message = formatError(error);
    console.error(`\n❌ Code Review Failed: ${message}`);
    logger.error('CLI review execution failed', { error });
    process.exit(1);
  }
}

// Execute when run directly
if (process.argv[1] && (process.argv[1].endsWith('main.ts') || process.argv[1].endsWith('main.js'))) {
  main();
}

export { main };
