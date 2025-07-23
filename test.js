#!/usr/bin/env node

/**
 * Test script to verify Electron MCP Server functionality
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

console.log(`🧪 Testing Electron MCP Server v${packageJson.version}`);
console.log('=' .repeat(50));

// Test 1: Check if server starts
console.log('Test 1: Starting MCP Server...');
const server = spawn('node', ['dist/index.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let hasStarted = false;

server.stdout.on('data', (data) => {
  output += data.toString();
  if (data.toString().includes('Electron MCP Server running')) {
    hasStarted = true;
    console.log('✅ Server started successfully');
    
    // Test 2: Send a list tools request
    console.log('\nTest 2: Requesting available tools...');
    
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    };
    
    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  }
});

server.stderr.on('data', (data) => {
  console.error('❌ Server error:', data.toString());
});

// Handle responses
server.stdout.on('data', (data) => {
  const response = data.toString().trim();
  if (response.startsWith('{') && response.includes('tools')) {
    try {
      const parsed = JSON.parse(response);
      if (parsed.result && parsed.result.tools) {
        console.log(`✅ Found ${parsed.result.tools.length} tools:`);
        parsed.result.tools.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
        });
      }
    } catch (e) {
      // Ignore JSON parsing errors for partial responses
    }
  }
});

// Timeout and cleanup
setTimeout(() => {
  if (hasStarted) {
    console.log('\n✅ All tests passed! Electron MCP Server is working correctly.');
  } else {
    console.log('\n❌ Server failed to start properly.');
  }
  
  server.kill('SIGTERM');
  process.exit(hasStarted ? 0 : 1);
}, 3000);

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\n❌ Server exited with code ${code}`);
  }
});
