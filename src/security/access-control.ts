import { randomUUID, createHash, timingSafeEqual } from "crypto";
import { UserPermissions, RateLimiter } from "./validation.js";
import { logger } from "../utils/logger.js";

export interface User {
  id: string;
  username: string;
  hashedPassword: string;
  permissions: string[];
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  apiKey?: string;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  permissions: string[];
  isValid: boolean;
}

export type Permission = 
  | 'execute_code'
  | 'take_screenshot' 
  | 'read_logs'
  | 'window_management'
  | 'file_system'
  | 'network_access'
  | 'admin';

export class AccessControl {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, SessionData> = new Map();
  private rateLimiter = new RateLimiter();
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.initializeDefaultUser();
    this.startSessionCleanup();
  }

  // User Management
  async createUser(
    username: string, 
    password: string, 
    permissions: Permission[] = ['execute_code', 'take_screenshot'],
    rateLimit = { maxRequests: 100, windowMs: 60000 }
  ): Promise<User> {
    const userId = randomUUID();
    const hashedPassword = this.hashPassword(password);
    const apiKey = this.generateApiKey();

    const user: User = {
      id: userId,
      username,
      hashedPassword,
      permissions,
      rateLimit,
      createdAt: new Date(),
      isActive: true,
      apiKey
    };

    this.users.set(userId, user);
    logger.info(`User created: ${username} (${userId})`);
    
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<string | null> {
    const user = Array.from(this.users.values()).find(u => u.username === username);
    
    if (!user || !user.isActive) {
      logger.warn(`Authentication failed for user: ${username} (user not found or inactive)`);
      return null;
    }

    if (!this.verifyPassword(password, user.hashedPassword)) {
      logger.warn(`Authentication failed for user: ${username} (invalid password)`);
      return null;
    }

    // Create session
    const sessionId = randomUUID();
    const session: SessionData = {
      userId: user.id,
      sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      permissions: user.permissions,
      isValid: true
    };

    this.sessions.set(sessionId, session);
    
    // Update last login
    user.lastLogin = new Date();
    
    logger.info(`User authenticated: ${username} (session: ${sessionId})`);
    return sessionId;
  }

  async authenticateApiKey(apiKey: string): Promise<string | null> {
    const user = Array.from(this.users.values()).find(u => u.apiKey === apiKey);
    
    if (!user || !user.isActive) {
      logger.warn(`API key authentication failed: invalid or inactive user`);
      return null;
    }

    // Create session for API key authentication
    const sessionId = randomUUID();
    const session: SessionData = {
      userId: user.id,
      sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      permissions: user.permissions,
      isValid: true
    };

    this.sessions.set(sessionId, session);
    logger.info(`API key authenticated for user: ${user.username} (session: ${sessionId})`);
    return sessionId;
  }

  // Permission Checking
  hasPermission(sessionId: string, permission: Permission): boolean {
    const session = this.getValidSession(sessionId);
    if (!session) return false;

    // Admin users have all permissions
    if (session.permissions.includes('admin')) return true;
    
    return session.permissions.includes(permission);
  }

  checkRateLimit(sessionId: string): boolean {
    const session = this.getValidSession(sessionId);
    if (!session) return false;

    const user = this.users.get(session.userId);
    if (!user) return false;

    return this.rateLimiter.checkLimit(
      session.userId,
      user.rateLimit.maxRequests,
      user.rateLimit.windowMs
    );
  }

  getRemainingRequests(sessionId: string): number {
    const session = this.getValidSession(sessionId);
    if (!session) return 0;

    const user = this.users.get(session.userId);
    if (!user) return 0;

    return this.rateLimiter.getRemainingRequests(
      session.userId,
      user.rateLimit.maxRequests,
      user.rateLimit.windowMs
    );
  }

  // Session Management
  getValidSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isValid) return null;

    // Check if session has expired
    const now = new Date();
    if (now.getTime() - session.lastActivity.getTime() > this.sessionTimeout) {
      this.invalidateSession(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = now;
    return session;
  }

  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isValid = false;
      logger.info(`Session invalidated: ${sessionId}`);
    }
  }

  invalidateAllSessions(userId: string): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        session.isValid = false;
        logger.info(`Session invalidated: ${sessionId} (user: ${userId})`);
      }
    }
  }

  // User Information
  getUserBySession(sessionId: string): User | null {
    const session = this.getValidSession(sessionId);
    if (!session) return null;
    
    return this.users.get(session.userId) || null;
  }

  getUserById(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  listUsers(): User[] {
    return Array.from(this.users.values()).map(user => ({
      ...user,
      hashedPassword: '[REDACTED]',
      apiKey: user.apiKey ? '[REDACTED]' : undefined
    }));
  }

  // User Management Operations
  updateUserPermissions(userId: string, permissions: Permission[]): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.permissions = permissions;
    
    // Invalidate all sessions for this user to force re-authentication
    this.invalidateAllSessions(userId);
    
    logger.info(`Updated permissions for user ${user.username}: ${permissions.join(', ')}`);
    return true;
  }

  deactivateUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.isActive = false;
    this.invalidateAllSessions(userId);
    
    logger.info(`Deactivated user: ${user.username}`);
    return true;
  }

  activateUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.isActive = true;
    logger.info(`Activated user: ${user.username}`);
    return true;
  }

  regenerateApiKey(userId: string): string | null {
    const user = this.users.get(userId);
    if (!user) return null;

    user.apiKey = this.generateApiKey();
    logger.info(`Regenerated API key for user: ${user.username}`);
    return user.apiKey;
  }

  // Utility Methods
  private hashPassword(password: string): string {
    return createHash('sha256').update(password + 'mcp-server-salt').digest('hex');
  }

  private verifyPassword(password: string, hashedPassword: string): boolean {
    const inputHash = this.hashPassword(password);
    const inputBuffer = Buffer.from(inputHash);
    const storedBuffer = Buffer.from(hashedPassword);
    
    if (inputBuffer.length !== storedBuffer.length) return false;
    return timingSafeEqual(inputBuffer, storedBuffer);
  }

  private generateApiKey(): string {
    return 'mcp_' + randomUUID().replace(/-/g, '');
  }

  private initializeDefaultUser(): void {
    // Create default admin user if no users exist
    if (this.users.size === 0) {
      const defaultPassword = process.env.MCP_ADMIN_PASSWORD || 'admin123';
      this.createUser(
        'admin',
        defaultPassword,
        ['admin'],
        { maxRequests: 1000, windowMs: 60000 }
      ).then(user => {
        logger.info(`Default admin user created. API Key: ${user.apiKey}`);
        logger.warn(`Please change the default password! Username: admin, Password: ${defaultPassword}`);
      });
    }
  }

  private startSessionCleanup(): void {
    // Clean up expired sessions every hour
    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;

      for (const [sessionId, session] of this.sessions) {
        if (!session.isValid || now.getTime() - session.lastActivity.getTime() > this.sessionTimeout) {
          this.sessions.delete(sessionId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug(`Cleaned up ${cleanedCount} expired sessions`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

// Global access control instance
export const accessControl = new AccessControl();
