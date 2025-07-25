import { logger } from "../utils/logger.js";
import { InputValidator, ValidationResult } from "./validation.js";

export interface DryRunResult {
  wouldExecute: boolean;
  command: string;
  sanitizedCommand: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: string[];
  estimatedImpact: string;
  recommendations: string[];
  executionPlan: ExecutionStep[];
}

export interface ExecutionStep {
  step: number;
  action: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface DryRunOptions {
  analyzeOnly: boolean;
  includeRecommendations: boolean;
  detailedRisks: boolean;
}

export class DryRunAnalyzer {
  
  static async analyzeCommand(
    command: string, 
    args?: any,
    options: DryRunOptions = {
      analyzeOnly: true,
      includeRecommendations: true,
      detailedRisks: true
    }
  ): Promise<DryRunResult> {
    logger.info(`Dry-run analysis starting for command: ${command.substring(0, 100)}...`);

    // Validate the command
    const validation = InputValidator.validateCommand({ command, args });
    
    // Analyze the command content
    const analysis = this.analyzeCommandContent(command);
    
    // Generate execution plan
    const executionPlan = this.generateExecutionPlan(command, analysis);
    
    // Generate recommendations
    const recommendations = options.includeRecommendations 
      ? this.generateRecommendations(analysis, validation)
      : [];

    const result: DryRunResult = {
      wouldExecute: validation.isValid && validation.riskLevel !== 'critical',
      command,
      sanitizedCommand: validation.sanitizedInput?.command || command,
      riskLevel: validation.riskLevel,
      risks: validation.errors,
      estimatedImpact: this.estimateImpact(analysis),
      recommendations,
      executionPlan
    };

    logger.info(`Dry-run analysis completed. Would execute: ${result.wouldExecute}, Risk: ${result.riskLevel}`);
    return result;
  }

  private static analyzeCommandContent(command: string): CommandAnalysis {
    const analysis: CommandAnalysis = {
      commandType: this.detectCommandType(command),
      potentialTargets: this.extractTargets(command),
      dataAccess: this.analyzeDataAccess(command),
      systemInteraction: this.analyzeSystemInteraction(command),
      networkActivity: this.analyzeNetworkActivity(command),
      riskFactors: []
    };

    // Add risk factors based on analysis
    if (analysis.systemInteraction.fileSystem) {
      analysis.riskFactors.push('file_system_access');
    }
    if (analysis.systemInteraction.processControl) {
      analysis.riskFactors.push('process_control');
    }
    if (analysis.networkActivity.outbound) {
      analysis.riskFactors.push('network_access');
    }
    if (analysis.dataAccess.sensitive) {
      analysis.riskFactors.push('sensitive_data_access');
    }

    return analysis;
  }

  private static detectCommandType(command: string): CommandType {
    // DOM manipulation commands
    if (/document\.|element\.|querySelector|getElementById/i.test(command)) {
      return 'dom_manipulation';
    }
    
    // UI interaction commands
    if (/click|focus|submit|scroll|resize/i.test(command)) {
      return 'ui_interaction';
    }
    
    // Data extraction commands
    if (/innerText|innerHTML|value|getAttribute/i.test(command)) {
      return 'data_extraction';
    }
    
    // Navigation commands
    if (/location\.|window\.open|history\./i.test(command)) {
      return 'navigation';
    }
    
    // JavaScript evaluation
    if (/eval|Function|new\s+Function/i.test(command)) {
      return 'code_execution';
    }
    
    return 'general';
  }

  private static extractTargets(command: string): string[] {
    const targets: string[] = [];
    
    // Extract CSS selectors
    const selectorMatches = command.match(/['"]([.#]?[\w-]+)['"]|querySelector\(['"]([^'"]+)['"]\)/g);
    if (selectorMatches) {
      targets.push(...selectorMatches.map(match => match.replace(/['"]/g, '')));
    }
    
    // Extract element IDs
    const idMatches = command.match(/getElementById\(['"]([^'"]+)['"]\)/g);
    if (idMatches) {
      targets.push(...idMatches.map(match => match.match(/['"]([^'"]+)['"]/)?.[1] || ''));
    }
    
    // Extract URLs
    const urlMatches = command.match(/https?:\/\/[^\s'"]+/g);
    if (urlMatches) {
      targets.push(...urlMatches);
    }
    
    return targets.filter(Boolean);
  }

  private static analyzeDataAccess(command: string): DataAccessAnalysis {
    return {
      reads: /innerText|innerHTML|value|getAttribute|textContent/i.test(command),
      writes: /innerHTML\s*=|value\s*=|setAttribute|appendChild/i.test(command),
      sensitive: /password|token|key|secret|credential|cookie|session/i.test(command),
      localStorage: /localStorage|sessionStorage/i.test(command),
      cookies: /document\.cookie/i.test(command)
    };
  }

  private static analyzeSystemInteraction(command: string): SystemInteractionAnalysis {
    return {
      fileSystem: /fs\.|readFile|writeFile|unlink|mkdir/i.test(command),
      processControl: /spawn|exec|fork|kill|exit/i.test(command),
      networking: /fetch|XMLHttpRequest|WebSocket|http/i.test(command),
      browserControl: /window\.|location\.|history\./i.test(command)
    };
  }

  private static analyzeNetworkActivity(command: string): NetworkActivityAnalysis {
    return {
      outbound: /fetch|XMLHttpRequest|WebSocket|window\.open/i.test(command),
      inbound: /addEventListener.*message|postMessage/i.test(command),
      crossOrigin: /cors|cross-origin|different.*origin/i.test(command)
    };
  }

  private static generateExecutionPlan(command: string, analysis: CommandAnalysis): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    let stepNumber = 1;

    // Validation step
    steps.push({
      step: stepNumber++,
      action: 'Input Validation',
      description: 'Validate and sanitize the command input',
      riskLevel: 'low',
      mitigation: 'Filter dangerous patterns and escape special characters'
    });

    // Command analysis
    steps.push({
      step: stepNumber++,
      action: 'Command Analysis',
      description: `Analyze ${analysis.commandType} command for risks`,
      riskLevel: analysis.riskFactors.length > 2 ? 'high' : 'medium'
    });

    // Permission check
    steps.push({
      step: stepNumber++,
      action: 'Permission Check',
      description: 'Verify user has required permissions',
      riskLevel: 'low'
    });

    // Sandbox preparation
    if (analysis.commandType === 'code_execution') {
      steps.push({
        step: stepNumber++,
        action: 'Sandbox Preparation',
        description: 'Prepare isolated execution environment',
        riskLevel: 'medium',
        mitigation: 'Use restricted Node.js context with limited global access'
      });
    }

    // Target verification
    if (analysis.potentialTargets.length > 0) {
      steps.push({
        step: stepNumber++,
        action: 'Target Verification',
        description: `Verify target elements/URLs: ${analysis.potentialTargets.slice(0, 3).join(', ')}`,
        riskLevel: analysis.potentialTargets.some(t => t.startsWith('http')) ? 'high' : 'low'
      });
    }

    // Execution
    steps.push({
      step: stepNumber++,
      action: 'Command Execution',
      description: `Execute ${analysis.commandType} in controlled environment`,
      riskLevel: this.calculateExecutionRisk(analysis),
      mitigation: 'Monitor execution time and resource usage'
    });

    // Result validation
    steps.push({
      step: stepNumber++,
      action: 'Result Validation',
      description: 'Validate and sanitize execution results',
      riskLevel: 'low',
      mitigation: 'Filter sensitive data from results'
    });

    return steps;
  }

  private static generateRecommendations(
    analysis: CommandAnalysis, 
    validation: ValidationResult
  ): string[] {
    const recommendations: string[] = [];

    if (validation.riskLevel === 'critical') {
      recommendations.push('❌ BLOCKED: Command contains critical security risks and should not be executed');
      recommendations.push('Consider breaking down the operation into smaller, safer commands');
    }

    if (validation.riskLevel === 'high') {
      recommendations.push('⚠️ HIGH RISK: Review command carefully before execution');
      recommendations.push('Consider running in a more restricted sandbox environment');
    }

    if (analysis.dataAccess.sensitive) {
      recommendations.push('🔒 Sensitive data detected: Ensure proper encryption and access logging');
    }

    if (analysis.systemInteraction.fileSystem) {
      recommendations.push('📁 File system access: Verify file paths and permissions');
    }

    if (analysis.networkActivity.outbound) {
      recommendations.push('🌐 Network activity: Review target URLs and consider firewall rules');
    }

    if (analysis.systemInteraction.processControl) {
      recommendations.push('⚙️ Process control: Verify command is necessary and safe');
    }

    if (analysis.commandType === 'code_execution') {
      recommendations.push('🔒 Code execution: Consider using static analysis before runtime');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Command appears safe for execution');
    }

    return recommendations;
  }

  private static estimateImpact(analysis: CommandAnalysis): string {
    const impacts: string[] = [];

    switch (analysis.commandType) {
      case 'dom_manipulation':
        impacts.push('May modify page content and user interface');
        break;
      case 'ui_interaction':
        impacts.push('Will trigger user interface events and interactions');
        break;
      case 'data_extraction':
        impacts.push('Will read data from the page or application');
        break;
      case 'navigation':
        impacts.push('May change page location or browser state');
        break;
      case 'code_execution':
        impacts.push('Will execute arbitrary JavaScript code');
        break;
      default:
        impacts.push('General command execution');
    }

    if (analysis.dataAccess.writes) {
      impacts.push('May modify application data');
    }

    if (analysis.systemInteraction.fileSystem) {
      impacts.push('May access or modify files');
    }

    if (analysis.networkActivity.outbound) {
      impacts.push('May initiate network requests');
    }

    return impacts.join('. ');
  }

  private static calculateExecutionRisk(analysis: CommandAnalysis): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Command type risks
    switch (analysis.commandType) {
      case 'code_execution': riskScore += 3; break;
      case 'navigation': riskScore += 2; break;
      case 'dom_manipulation': riskScore += 1; break;
      default: riskScore += 0;
    }

    // Additional risk factors
    if (analysis.dataAccess.sensitive) riskScore += 2;
    if (analysis.systemInteraction.fileSystem) riskScore += 2;
    if (analysis.systemInteraction.processControl) riskScore += 3;
    if (analysis.networkActivity.outbound) riskScore += 1;

    if (riskScore >= 5) return 'critical';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }
}

// Supporting interfaces
interface CommandAnalysis {
  commandType: CommandType;
  potentialTargets: string[];
  dataAccess: DataAccessAnalysis;
  systemInteraction: SystemInteractionAnalysis;
  networkActivity: NetworkActivityAnalysis;
  riskFactors: string[];
}

type CommandType = 
  | 'dom_manipulation'
  | 'ui_interaction' 
  | 'data_extraction'
  | 'navigation'
  | 'code_execution'
  | 'general';

interface DataAccessAnalysis {
  reads: boolean;
  writes: boolean;
  sensitive: boolean;
  localStorage: boolean;
  cookies: boolean;
}

interface SystemInteractionAnalysis {
  fileSystem: boolean;
  processControl: boolean;
  networking: boolean;
  browserControl: boolean;
}

interface NetworkActivityAnalysis {
  outbound: boolean;
  inbound: boolean;
  crossOrigin: boolean;
}
