import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createTestElectronApp, waitForElectronApp, type TestElectronApp } from './helpers/test-electron-app.js';
import { handleToolCall } from '../src/handlers.js';
import { ToolName } from '../src/tools.js';
import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';

// Helper function to create proper MCP request format
function createMCPRequest(toolName: string, args: any = {}) {
  return {
    method: "tools/call" as const,
    params: {
      name: toolName,
      arguments: args
    }
  };
}

describe('Electron Integration E2E Tests with Real App', () => {
  let testApp: TestElectronApp;
  let globalTestDir: string;

  beforeAll(async () => {
    // Create global test directory
    globalTestDir = join(tmpdir(), `mcp-electron-integration-test-${Date.now()}`);
    await fs.mkdir(globalTestDir, { recursive: true });

    // Start test Electron app
    testApp = await createTestElectronApp(9223); // Use different port to avoid conflicts
    
    // Wait for app to be ready
    const isReady = await waitForElectronApp(9223, 15000);
    if (!isReady) {
      throw new Error('Test Electron app failed to become ready');
    }
    
    console.log('✅ Test Electron app ready for integration testing');
  }, 30000);

  afterAll(async () => {
    if (testApp) {
      await testApp.cleanup();
      console.log('✅ Test Electron app cleaned up');
    }
    
    // Cleanup global test directory
    try {
      await fs.rm(globalTestDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  }, 10000);

  describe('Electron Connection Integration', () => {
    it('should discover running test Electron app', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.GET_ELECTRON_WINDOW_INFO, {}));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const response = JSON.parse(result.content[0].text);
        expect(response.automationReady).toBe(true);
        expect(response.devToolsPort).toBe(9223);
        expect(response.windows).toHaveLength(1);
        expect(response.windows[0].title).toBe('Test Electron App');
      }
    });

    it('should get window info with children', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.GET_ELECTRON_WINDOW_INFO, {
        includeChildren: true
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const response = JSON.parse(result.content[0].text);
        expect(response.automationReady).toBe(true);
        expect(response.totalTargets).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Enhanced Command Integration', () => {
    it('should execute basic commands successfully', async () => {
      const commands = [
        { command: 'get_title' },
        { command: 'get_url' },
        { command: 'get_body_text' }
      ];

      for (const cmd of commands) {
        const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, cmd));
        expect(result.isError).toBe(false);
        if (!result.isError) {
          expect(result.content[0].text).toContain('✅');
        }
      }
    });

    it('should find and analyze page elements', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'find_elements'
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const response = result.content[0].text;
        expect(response).toContain('test-button');
        expect(response).toContain('submit-button');
        expect(response).toContain('username-input');
      }
    });

    it('should get page structure successfully', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'get_page_structure'
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const response = result.content[0].text;
        expect(response).toContain('buttons');
        expect(response).toContain('inputs');
      }
    });

    it('should click elements by text', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'click_by_text',
        args: { text: 'Test Button' }
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('✅');
      }
    });

    it('should fill input fields', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'fill_input',
        args: {
          text: 'Username',
          value: 'testuser'
        }
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('✅');
      }
    });

    it('should select dropdown options', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'select_option',
        args: {
          value: 'us',
          text: 'United States'
        }
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('✅');
      }
    });

    it('should execute custom eval commands', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'window.testAppState.version'
        }
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('1.0.0');
      }
    });

    it('should handle complex JavaScript execution', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: `
            const button = document.getElementById('test-button');
            button.click();
            return {
              clicked: true,
              buttonText: button.textContent,
              timestamp: Date.now()
            };
          `
        }
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const response = result.content[0].text;
        expect(response).toContain('clicked');
        expect(response).toContain('Test Button');
      }
    });
  });

  describe('Screenshot Integration', () => {
    it('should take screenshot of running app', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.TAKE_SCREENSHOT, {}));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('base64');
      }
    });

    it('should take screenshot with output path', async () => {
      const outputPath = join(globalTestDir, 'test-screenshot.png');
      
      const result = await handleToolCall(createMCPRequest(ToolName.TAKE_SCREENSHOT, {
        outputPath
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        // Check if file was created
        const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should take screenshot with window title', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.TAKE_SCREENSHOT, {
        windowTitle: 'Test Electron App'
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('base64');
      }
    });
  });

  describe('Log Reading Integration', () => {
    it('should read console logs', async () => {
      // First, generate some console logs
      await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'console.log("Test log message for MCP"); "Log generated"'
        }
      }));

      // Wait a moment for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await handleToolCall(createMCPRequest(ToolName.READ_ELECTRON_LOGS, {
        logType: 'console',
        lines: 10
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('Test log message');
      }
    });

    it('should read all log types', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.READ_ELECTRON_LOGS, {
        logType: 'all',
        lines: 50
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const logs = result.content[0].text;
        expect(logs.length).toBeGreaterThan(0);
      }
    });

    it('should limit log results by line count', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.READ_ELECTRON_LOGS, {
        logType: 'all',
        lines: 5
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        const logs = result.content[0].text.split('\n').filter(line => line.trim());
        expect(logs.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle complete form interaction workflow', async () => {
      // 1. Get page structure
      const structureResult = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'get_page_structure'
      }));
      expect(structureResult.isError).toBe(false);

      // 2. Fill username field
      const usernameResult = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'fill_input',
        args: { text: 'Username', value: 'integration-test-user' }
      }));
      expect(usernameResult.isError).toBe(false);

      // 3. Fill email field
      const emailResult = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'fill_input',
        args: { text: 'Email', value: 'test@example.com' }
      }));
      expect(emailResult.isError).toBe(false);

      // 4. Select country
      const selectResult = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'select_option',
        args: { value: 'ca', text: 'Canada' }
      }));
      expect(selectResult.isError).toBe(false);

      // 5. Click submit button
      const submitResult = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'click_by_text',
        args: { text: 'Submit' }
      }));
      expect(submitResult.isError).toBe(false);

      // 6. Verify the result
      const verifyResult = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'document.getElementById("output").innerHTML'
        }
      }));
      expect(verifyResult.isError).toBe(false);
      if (!verifyResult.isError) {
        expect(verifyResult.content[0].text).toContain('integration-test-user');
        expect(verifyResult.content[0].text).toContain('test@example.com');
      }
    });

    it('should handle rapid successive commands', async () => {
      const commands = [
        { command: 'get_title' },
        { command: 'get_url' },
        { command: 'eval', args: { code: 'document.readyState' } },
        { command: 'get_body_text' },
        { command: 'eval', args: { code: 'window.testAppState.ready' } }
      ];

      const results = await Promise.all(
        commands.map(cmd => handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, cmd)))
      );

      results.forEach(result => {
        expect(result.isError).toBe(false);
      });
    });

    it('should maintain state between commands', async () => {
      // Set some state
      const setState = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'window.testValue = "persistent-test-value"; window.testValue'
        }
      }));
      expect(setState.isError).toBe(false);

      // Retrieve state in a separate command
      const getState = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'window.testValue'
        }
      }));
      expect(getState.isError).toBe(false);
      if (!getState.isError) {
        expect(getState.content[0].text).toContain('persistent-test-value');
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle JavaScript errors gracefully', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'nonExistentFunction()'
        }
      }));
      
      expect(result.isError).toBe(false); // Should not error at MCP level
      if (!result.isError) {
        expect(result.content[0].text).toContain('error');
      }
    });

    it('should handle element not found scenarios', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'click_by_text',
        args: { text: 'Non Existent Button' }
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('not found');
      }
    });

    it('should handle invalid selector scenarios', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: {
          code: 'document.querySelector("#invalid>>selector")'
        }
      }));
      
      expect(result.isError).toBe(false); // Should handle gracefully
    });
  });
});
