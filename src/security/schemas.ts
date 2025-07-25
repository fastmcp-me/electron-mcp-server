import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Authentication schemas
export const AuthenticateUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const AuthenticateApiKeySchema = z.object({
  apiKey: z.string().min(1)
});

// Dry run schema
export const DryRunCommandSchema = z.object({
  command: z.string().min(1),
  args: z.any().optional()
});

// Security metrics schema
export const GetSecurityMetricsSchema = z.object({
  since: z.string().optional().describe("ISO date string for metrics since when")
});

// Audit log search schema
export const SearchAuditLogsSchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  since: z.string().optional().describe("ISO date string"),
  until: z.string().optional().describe("ISO date string"),
  limit: z.number().optional().default(100)
});

// User management schemas
export const CreateUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  permissions: z.array(z.enum([
    'execute_code', 'take_screenshot', 'read_logs', 
    'window_management', 'file_system', 'network_access', 'admin'
  ])).optional(),
  rateLimit: z.object({
    maxRequests: z.number().default(100),
    windowMs: z.number().default(60000)
  }).optional()
});

export const UpdateUserPermissionsSchema = z.object({
  userId: z.string(),
  permissions: z.array(z.enum([
    'execute_code', 'take_screenshot', 'read_logs', 
    'window_management', 'file_system', 'network_access', 'admin'
  ]))
});

// Security config schema
export const UpdateSecurityConfigSchema = z.object({
  enableSandbox: z.boolean().optional(),
  enableDryRun: z.boolean().optional(),
  enableRateLimit: z.boolean().optional(),
  enableAuditLog: z.boolean().optional(),
  enableAccessControl: z.boolean().optional(),
  defaultRiskThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  sandboxTimeout: z.number().optional(),
  maxExecutionTime: z.number().optional()
});

// Export JSON schemas for MCP tool definitions
export const securityToolSchemas = {
  authenticate_user: zodToJsonSchema(AuthenticateUserSchema),
  authenticate_api_key: zodToJsonSchema(AuthenticateApiKeySchema),
  dry_run_command: zodToJsonSchema(DryRunCommandSchema),
  get_security_metrics: zodToJsonSchema(GetSecurityMetricsSchema),
  search_audit_logs: zodToJsonSchema(SearchAuditLogsSchema),
  create_user: zodToJsonSchema(CreateUserSchema),
  update_user_permissions: zodToJsonSchema(UpdateUserPermissionsSchema),
  update_security_config: zodToJsonSchema(UpdateSecurityConfigSchema)
};
