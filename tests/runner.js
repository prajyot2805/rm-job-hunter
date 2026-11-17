#!/usr/bin/env node
/**
 * Corporate Banking RM Job Hunt Tool — Standalone Automated Test Runner
 * Pure Node.js standard library — Zero external npm dependencies.
 * Run via:
 *   export PATH="/Users/prajyotchakrawarti/.local/bin:$PATH"
 *   node tests/runner.js [options] [filter]
 *   node --test tests/e2e/*.test.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Parse CLI Arguments
const args = process.argv.slice(2);
let reporterType = 'spec';
let testFilter = null;
let customTimeout = 10000;
let bail = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--tap') {
    reporterType = 'tap';
    process.env.NODE_TEST_REPORTER = 'tap';
  } else if (arg === '--spec') {
    reporterType = 'spec';
    process.env.NODE_TEST_REPORTER = 'spec';
  } else if (arg === '--bail' || arg === '-b') {
    bail = true;
  } else if (arg === '--timeout' && args[i + 1]) {
    customTimeout = parseInt(args[++i], 10);
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Corporate Banking RM Job Hunt — Standalone Test Runner
Usage: node tests/runner.js [filter] [options]

Options:
  --spec            Format output using human-readable Spec reporter (default)
  --tap             Format output using TAP version 13
  --bail, -b        Stop running after first test failure
  --timeout <ms>    Set default timeout per test in milliseconds (default: 10000)
  --help, -h        Show this help message

Examples:
  node tests/runner.js                  Run all test suites (Tiers 1-5)
  node tests/runner.js tier1            Run only suites matching 'tier1'
  node tests/runner.js tier5            Run only suites matching 'tier5'
  node tests/runner.js --tap            Run all suites with TAP output
    `);
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    testFilter = arg;
  }
}

/**
 * Recursively discover all test files matching *.test.js or *.spec.js
 */
function discoverTestFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'harness' && entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...discoverTestFiles(fullPath));
      }
    } else if (entry.isFile()) {
      if ((entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js')) && entry.name !== 'runner.js') {
        results.push(fullPath);
      }
    }
  }
  return results;
}

async function main() {
  const testsDir = path.resolve(PROJECT_ROOT, 'tests');
  let testFiles = discoverTestFiles(testsDir);

  // Apply user filter if specified
  if (testFilter) {
    const normalizedFilter = testFilter.toLowerCase();
    testFiles = testFiles.filter(f => f.toLowerCase().includes(normalizedFilter));
  }

  // Tier-based sort order: Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> others
  testFiles.sort((a, b) => {
    const tierScore = (filePath) => {
      const lower = filePath.toLowerCase();
      if (lower.includes('tier1')) return 1;
      if (lower.includes('tier2')) return 2;
      if (lower.includes('tier3')) return 3;
      if (lower.includes('tier4')) return 4;
      if (lower.includes('tier5')) return 5;
      return 6;
    };
    const diff = tierScore(a) - tierScore(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  if (testFiles.length === 0) {
    console.warn(`No test files found matching criteria (filter: "${testFilter || 'none'}")`);
    process.exit(0);
  }

  console.log('='.repeat(72));
  console.log(' CORPORATE BANKING RM JOB HUNT — STANDALONE E2E TEST RUNNER');
  console.log('='.repeat(72));
  console.log(`Environment : Node ${process.version} (${process.platform}-${process.arch})`);
  console.log(`Working Dir : ${PROJECT_ROOT}`);
  console.log(`Discovered  : ${testFiles.length} test suite file(s)`);
  testFiles.forEach(f => console.log(`  • ${path.relative(PROJECT_ROOT, f)}`));
  console.log('-'.repeat(72) + '\n');

  const startTime = performance.now();

  // Load and execute each test file sequentially
  for (const file of testFiles) {
    const relPath = path.relative(PROJECT_ROOT, file);
    const fileUrl = pathToFileURL(file).href;
    try {
      await import(fileUrl);
    } catch (err) {
      console.error(`\n✖ Error executing test suite: ${relPath}`);
      console.error(err);
      process.exitCode = 1;
      if (bail) break;
    }
  }

  const durationMs = performance.now() - startTime;
  console.log('\n' + '-'.repeat(72));
  console.log(`Runner completed in ${durationMs.toFixed(1)}ms`);
  console.log('='.repeat(72));
}

main().catch(err => {
  console.error('Fatal Runner Exception:', err);
  process.exit(1);
});
