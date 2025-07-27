import { SecurityConfig } from './manager.js';
import { logger } from '../utils/logger.js';

export enum SecurityLevel {
  STRICT = 'strict', // Maximum security - blocks most function calls
  BALANCED = 'balanced', // Default - allows safe UI interactions
  PERMISSIVE = 'permissive', // Minimal restrictions - allows more operations
  DEVELOPMENT = 'development', // Least restrictive - for development/testing
}

export interface SecurityProfile {
  level: SecurityLevel;
  allowUIInteractions: boolean;
  allowDOMQueries: boolean;
  allowPropertyAccess: boolean;
  allowAssignments: boolean;
  allowFunctionCalls: string[]; // Whitelist of allowed function patterns
  riskThreshold: 'low' | 'medium' | 'high' | 'critical';
}

export const SECURITY_PROFILES: Record<SecurityLevel, SecurityProfile> = {
  [SecurityLevel.STRICT]: {
    level: SecurityLevel.STRICT,
    allowUIInteractions: false,
    allowDOMQueries: false,
    allowPropertyAccess: true,
    allowAssignments: false,
    allowFunctionCalls: [],
    riskThreshold: 'low',
  },

  [SecurityLevel.BALANCED]: {
    level: SecurityLevel.BALANCED,
    allowUIInteractions: true,
    allowDOMQueries: true,
    allowPropertyAccess: true,
    allowAssignments: false,
    allowFunctionCalls: [
      'querySelector',
      'querySelectorAll',
      'getElementById',
      'getElementsByClassName',
      'getElementsByTagName',
      'getComputedStyle',
      'getBoundingClientRect',
      'focus',
      'blur',
      'scrollIntoView',
      'dispatchEvent',
    ],
    riskThreshold: 'medium',
  },

  [SecurityLevel.PERMISSIVE]: {
    level: SecurityLevel.PERMISSIVE,
    allowUIInteractions: true,
    allowDOMQueries: true,
    allowPropertyAccess: true,
    allowAssignments: true,
    allowFunctionCalls: [
      'querySelector',
      'querySelectorAll',
      'getElementById',
      'getElementsByClassName',
      'getElementsByTagName',
      'getComputedStyle',
      'getBoundingClientRect',
      'focus',
      'blur',
      'scrollIntoView',
      'dispatchEvent',
      'click',
      'submit',
      'addEventListener',
      'removeEventListener',
    ],
    riskThreshold: 'high',
  },

  [SecurityLevel.DEVELOPMENT]: {
    level: SecurityLevel.DEVELOPMENT,
    allowUIInteractions: true,
    allowDOMQueries: true,
    allowPropertyAccess: true,
    allowAssignments: true,
    allowFunctionCalls: ['*'], // Allow all function calls
    riskThreshold: 'critical',
  },
};

export function getSecurityConfig(
  level: SecurityLevel = SecurityLevel.BALANCED,
): Partial<SecurityConfig> {
  const profile = SECURITY_PROFILES[level];

  return {
    defaultRiskThreshold: profile.riskThreshold,
    enableInputValidation: true,
    enableAuditLog: true,
    enableSandbox: level !== SecurityLevel.DEVELOPMENT,
    enableScreenshotEncryption: level !== SecurityLevel.DEVELOPMENT,
  };
}

/**
 * Environment-based security level detection
 * ALWAYS defaults to STRICT for maximum security
 */
export function detectSecurityLevel(): SecurityLevel {
  // Always start with the most secure level
  const explicitLevel = process.env.MCP_SECURITY_LEVEL?.toLowerCase();
  
  // Only allow explicit downgrade via environment variable
  switch (explicitLevel) {
    case 'balanced':
      logger.warn('Security level set to BALANCED via MCP_SECURITY_LEVEL environment variable');
      return SecurityLevel.BALANCED;
    case 'permissive':
      logger.warn('Security level set to PERMISSIVE via MCP_SECURITY_LEVEL environment variable');
      return SecurityLevel.PERMISSIVE;
    case 'development':
      logger.warn('Security level set to DEVELOPMENT via MCP_SECURITY_LEVEL environment variable - USE ONLY FOR DEVELOPMENT!');
      return SecurityLevel.DEVELOPMENT;
    case 'strict':
    default:
      // Default to strict security - never auto-detect based on environment
      return SecurityLevel.STRICT;
  }
}
