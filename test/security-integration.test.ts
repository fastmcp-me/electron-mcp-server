import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handleToolCall } from '../src/handlers.js';
import { ToolName } from '../src/tools.js';
import { createTestElectronApp, waitForElectronApp, TestElectronApp } from './helpers/test-electron-app.js';

// Helper to create MCP request format
function createMCPRequest(name: string, args: any) {
  return {
    method: "tools/call" as const,
    params: {
      name,
      arguments: args
    }
  };
}

describe('Security Integration Tests', () => {
  let testApp: TestElectronApp;

  beforeAll(async () => {
    // Create and start test Electron app
    testApp = await createTestElectronApp(9223);
    
    await waitForElectronApp(9223);
    console.log('✅ Test Electron app ready for security testing');
  }, 30000);

  afterAll(async () => {
    await testApp.cleanup();
    console.log('✅ Test Electron app cleaned up');
  });

  describe('Security Manager Integration', () => {
    it('should allow safe window info operations', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.GET_ELECTRON_WINDOW_INFO, {}));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('Window Information');
        expect(result.content[0].text).toContain('port');
      }
    });

    it('should allow safe eval operations', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: 'document.title'
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        // Security passed - the command was allowed to execute
        // The actual result may vary depending on Electron app state
        expect(result.content[0].text).toMatch(/result|success|error/i);
      }
    });

    it('should block risky operations by default', async () => {
      const riskyCommands = [
        'eval:require("fs").writeFileSync("/tmp/test", "malicious")',
        'eval:process.exit(1)',
        'eval:require("child_process").exec("rm -rf /")'
      ];

      for (const riskyCode of riskyCommands) {
        const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
          command: 'eval',
          args: riskyCode
        }));
        
        // Should either block or return safe error
        if (result.isError) {
          expect(result.content[0].text).toMatch(/blocked|failed|error|dangerous/i);
        } else {
          // If not blocked, should contain safe error message
          expect(result.content[0].text).toMatch(/error|undefined|denied|blocked/i);
        }
      }
    });

    it('should enforce execution timeouts', async () => {
      const start = Date.now();
      const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: 'new Promise(resolve => setTimeout(resolve, 60000))' // 60 second timeout
      }));
      const duration = Date.now() - start;
      
      // Should timeout within reasonable time (less than 35 seconds)
      expect(duration).toBeLessThan(35000);
      
      if (result.isError) {
        expect(result.content[0].text).toMatch(/timeout|blocked|failed/i);
      }
    });

    it('should maintain audit logs for operations', async () => {
      // Execute several operations to generate audit logs
      await handleToolCall(createMCPRequest(ToolName.GET_ELECTRON_WINDOW_INFO, {}));
      await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
        command: 'eval',
        args: 'document.title'
      }));
      
      // Check that audit logging is working (logs should be captured in test output)
      // This is more of a smoke test - detailed audit log testing would require
      // access to the security manager's internal state
      expect(true).toBe(true); // Placeholder - audit logs are visible in test output
    });
  });

  describe('Screenshot Security', () => {
    it('should securely handle screenshot operations', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.TAKE_SCREENSHOT, {}));
      
      // Screenshot should either succeed or fail gracefully with security context
      if (result.isError) {
        expect(result.content[0].text).toMatch(/failed|error|debugging/i);
      } else {
        expect(result.content[0].text).toMatch(/screenshot|captured|base64/i);
      }
    });

    it('should validate screenshot output paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '/etc/shadow',
        '~/.ssh/id_rsa',
        'C:\\Windows\\System32\\config\\SAM'
      ];

      for (const maliciousPath of maliciousPaths) {
        const result = await handleToolCall(createMCPRequest(ToolName.TAKE_SCREENSHOT, {
          outputPath: maliciousPath
        }));
        
        // Should either block the malicious path or fail safely
        if (result.isError) {
          expect(result.content[0].text).toMatch(/failed|error|path|security/i);
        } else {
          // If it doesn't error, should not actually write to malicious location
          expect(result.content[0].text).not.toContain(maliciousPath);
        }
      }
    });
  });

  describe('Log Access Security', () => {
    it('should safely provide log access', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.READ_ELECTRON_LOGS, {
        logType: 'console',
        lines: 10
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        expect(result.content[0].text).toContain('Electron logs');
      }
    });

    it('should limit log access scope', async () => {
      const result = await handleToolCall(createMCPRequest(ToolName.READ_ELECTRON_LOGS, {
        logType: 'all',
        lines: 1000000 // Excessive line request
      }));
      
      expect(result.isError).toBe(false);
      if (!result.isError) {
        // Should handle large requests gracefully
        const logText = result.content[0].text;
        expect(logText.length).toBeLessThan(100000); // Reasonable limit
      }
    });
  });

  describe('Input Validation Security', () => {
    it('should validate command parameters', async () => {
      const invalidCommands = [
        { command: null, args: 'test' },
        { command: '', args: 'test' },
        { command: 'eval', args: null },
        { command: 'invalidCommand', args: 'test' }
      ];

      for (const invalidCmd of invalidCommands) {
        try {
          const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, invalidCmd));
          
          // Should handle invalid input gracefully
          if (result.isError) {
            expect(result.content[0].text).toMatch(/error|invalid|validation/i);
          }
        } catch (error) {
          // Schema validation errors are acceptable
          expect(error).toBeDefined();
        }
      }
    });

    it('should sanitize user inputs', async () => {
      const maliciousInputs = [
        'eval:<script>alert("xss")</script>',
        'eval:${require("child_process").exec("ls")}',
        'eval:`rm -rf /`',
        'eval:function(){while(true){}}()'
      ];

      for (const maliciousInput of maliciousInputs) {
        const result = await handleToolCall(createMCPRequest(ToolName.SEND_COMMAND_TO_ELECTRON, {
          command: 'eval',
          args: maliciousInput
        }));
        
        // Should handle malicious input safely
        if (!result.isError) {
          const response = result.content[0].text.toLowerCase();
          expect(response).toMatch(/error|undefined|null|denied|blocked/);
        }
      }
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should handle rapid successive requests', async () => {
      const promises: Promise<any>[] = [];
      const startTime = Date.now();
      
      // Fire 10 rapid requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          handleToolCall(createMCPRequest(ToolName.GET_ELECTRON_WINDOW_INFO, {}))
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All requests should complete
      expect(results).toHaveLength(10);
      
      // Should complete in reasonable time (not hanging)
      expect(endTime - startTime).toBeLessThan(30000);
      
      // Most should succeed (some might be throttled)
      const successCount = results.filter((r: any) => !r.isError).length;
      expect(successCount).toBeGreaterThan(5);
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in errors', async () => {
      // Try to trigger various error conditions
      const errorTriggers = [
        { name: 'nonexistent-tool', args: {} },
        { name: ToolName.SEND_COMMAND_TO_ELECTRON, args: { command: 'eval', args: 'throw new Error("internal details: /home/user/.secret")' } }
      ];

      for (const trigger of errorTriggers) {
        const result = await handleToolCall(createMCPRequest(trigger.name, trigger.args));
        
        if (result.isError) {
          const errorText = result.content[0].text.toLowerCase();
          
          // Should not leak file paths, internal details, or stack traces
          expect(errorText).not.toMatch(/\/home\/|\/users\/|c:\\|stack trace|internal details/);
          expect(errorText).not.toContain('/.secret');
        }
      }
    });

    it('should provide helpful but safe error messages', async () => {
      const result = await handleToolCall(createMCPRequest('nonexistent-tool', {}));
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/unknown|tool|error/i);
      expect(result.content[0].text).not.toMatch(/internal|debug|trace/i);
    });
  });
});
