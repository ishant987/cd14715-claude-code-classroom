import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';
import { formatError } from './utils/error-handler.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // 1. Validate command line arguments
  if (!owner || !repo || !prStr) {
    console.error('❌ Error: Missing required command-line arguments.');
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- udacity cd14715-simple-todo-app 1');
    process.exit(1);
  }

  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0 || !Number.isInteger(prNumber)) {
    console.error(`❌ Error: Invalid PR number "${prStr}". Must be a positive integer.`);
    process.exit(1);
  }

  // 2. Validate authentication (choose ONE method)
  const hasAnthropicAPI = !!process.env.ANTHROPIC_API_KEY;
  const hasAWSCredentials = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );

  if (hasAWSCredentials) {
    if (!process.env.AWS_REGION) {
      console.error('❌ Error: AWS credentials found but AWS_REGION environment variable is not set.');
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicAPI) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error('❌ Error: Authentication required. Please configure one of the following:');
    console.error('  1. Anthropic API: Set ANTHROPIC_API_KEY in your environment or .env');
    console.error('  2. AWS Bedrock: Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION');
    process.exit(1);
  }

  // 3. Validate ANTHROPIC_MODEL environment variable
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    console.error('❌ Error: ANTHROPIC_MODEL environment variable is required.');
    console.error('Examples:');
    console.error('  - Anthropic API: ANTHROPIC_MODEL=claude-sonnet-4-5-20250929');
    console.error('  - AWS Bedrock:   ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    process.exit(1);
  }

  console.log(`🚀 Starting Code Review: ${owner}/${repo}#${prNumber}`);
  console.log(`🤖 Model: ${model}`);

  try {
    const orchestrator = new CodeReviewOrchestrator({ model });
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const reportsDir = path.resolve(process.cwd(), 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const baseFileName = `${owner}_${repo}_${prNumber}`;
    const jsonPath = path.join(reportsDir, `${baseFileName}.json`);
    const mdPath = path.join(reportsDir, `${baseFileName}.md`);
    const htmlPath = path.join(reportsDir, `${baseFileName}.html`);

    fs.writeFileSync(jsonPath, reportGenerator.generateJSONReport(report), 'utf-8');
    fs.writeFileSync(mdPath, reportGenerator.generateMarkdownReport(report), 'utf-8');
    fs.writeFileSync(htmlPath, reportGenerator.generateHTMLReport(report), 'utf-8');

    console.log('\n✨ Pull Request Review Completed Successfully!');
    console.log('📊 Generated Reports:');
    console.log(`   - JSON:     ${jsonPath}`);
    console.log(`   - Markdown: ${mdPath}`);
    console.log(`   - HTML:     ${htmlPath}`);
    console.log(`\nOverall Quality Score: ${report.summary.overallScore}/100`);
    console.log(`Files Reviewed: ${report.summary.totalFiles}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
  } catch (error) {
    logger.error('Failed to execute code review:', error);
    console.error(`\n❌ Code Review Failed: ${formatError(error)}`);
    process.exit(1);
  }
}

main();
