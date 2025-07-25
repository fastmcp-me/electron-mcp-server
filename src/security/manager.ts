import { CodeSandbox, SandboxResult } from "./sandbox.js";
import { InputValidator, ValidationResult } from "./validation.js";
import { securityLogger, AuditLogEntry } from "./audit.js";
import { DryRunAnalyzer, DryRunResult } from "./dry-run.js";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";

export interface SecurityConfig {
  enableSandbox: boolean;
  enableInputValidation: boolean;
  enableAuditLog: boolean;
  enableScreenshotEncryption: boolean;
  defaultRiskThreshold: 'low' | 'medium' | 'high' | 'critical';
  sandboxTimeout: number;
  maxExecutionTime: number;
}

export interface SecureExecutionContext {
  command: string;
  args?: any;
  sourceIP?: string;
  userAgent?: string;
  operationType: 'command' | 'screenshot' | 'logs' | 'window_info';
}

export interface SecureExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
  sessionId: string;
}

export class SecurityManager {
  private config: SecurityConfig;
  private sandbox: CodeSandbox;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableSandbox: true,
      enableInputValidation: true,
      enableAuditLog: true,
      enableScreenshotEncryption: true,
      defaultRiskThreshold: 'medium',
      sandboxTimeout: 5000,
      maxExecutionTime: 30000,
      ...config
    };

    this.sandbox = new CodeSandbox({
      timeout: this.config.sandboxTimeout,
      maxMemory: 50 * 1024 * 1024, // 50MB
    });

    logger.info('Security Manager initialized with config:', this.config);
  }

  async executeSecurely(context: SecureExecutionContext): Promise<SecureExecutionResult> {
    const sessionId = randomUUID();
    const startTime = Date.now();

    logger.info(`Secure execution started [${sessionId}]`, {
      command: context.command.substring(0, 100),
      operationType: context.operationType
    });

    try {
      // Step 1: Input Validation
      const validation = InputValidator.validateCommand({
        command: context.command,
        args: context.args
      });

      if (!validation.isValid) {
        const reason = `Input validation failed: ${validation.errors.join(', ')}`;
        return this.createBlockedResult(sessionId, startTime, reason, validation.riskLevel);
      }

      // Step 2: Risk Assessment
      if (validation.riskLevel === 'critical' || 
          (this.config.defaultRiskThreshold === 'high' && validation.riskLevel === 'high')) {
        const reason = `Risk level too high: ${validation.riskLevel}`;
        return this.createBlockedResult(sessionId, startTime, reason, validation.riskLevel);
      }

      // Step 3: Sandboxed Execution (for code execution only)
      let executionResult: SandboxResult;
      if (context.operationType === 'command' && this.config.enableSandbox) {
        executionResult = await this.sandbox.executeCode(validation.sanitizedInput.command);
      } else {
        // For other operations (screenshot, logs, etc.), skip sandbox
        executionResult = {
          success: true,
          result: validation.sanitizedInput.command,
          executionTime: 0
        };
      }

      // Step 4: Create result
      const result: SecureExecutionResult = {
        success: executionResult.success,
        result: executionResult.result,
        error: executionResult.error,
        executionTime: Date.now() - startTime,
        riskLevel: validation.riskLevel,
        blocked: false,
        sessionId
      };

      // Step 5: Audit Logging
      if (this.config.enableAuditLog) {
        await this.logSecurityEvent(context, result);
      }

      logger.info(`Secure execution completed [${sessionId}]`, {
        success: result.success,
        executionTime: result.executionTime,
        riskLevel: result.riskLevel
      });

      return result;

    } catch (error) {
      const result: SecureExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        riskLevel: 'high',
        blocked: false,
        sessionId
      };

      if (this.config.enableAuditLog) {
        await this.logSecurityEvent(context, result);
      }

      logger.error(`Secure execution failed [${sessionId}]:`, error);
      return result;
    }
  }

  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Security configuration updated:', newConfig);
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Private helper methods
  private createBlockedResult(
    sessionId: string,
    startTime: number,
    reason: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): SecureExecutionResult {
    return {
      success: false,
      error: reason,
      executionTime: Date.now() - startTime,
      riskLevel,
      blocked: true,
      sessionId
    };
  }

  private async logSecurityEvent(
    context: SecureExecutionContext,
    result: SecureExecutionResult
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: result.sessionId,
      action: context.operationType,
      command: context.command,
      riskLevel: result.riskLevel,
      success: result.success,
      error: result.error,
      executionTime: result.executionTime,
      sourceIP: context.sourceIP,
      userAgent: context.userAgent
    };

    await securityLogger.logSecurityEvent(logEntry);
  }
}

// Global security manager instance
export const securityManager = new SecurityManager();
