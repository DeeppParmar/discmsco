// lib/accountManager.js - Expert account management with health monitoring
import { DiscordClient } from './discordClient.js';

class AccountProfile {
  constructor(email, password, token) {
    this.id = this.generateId();
    this.email = email;
    this.password = password;
    this.token = token;
    
    // Account metadata
    this.userId = null;
    this.username = null;
    this.avatar = null;
    this.email_verified = false;
    this.has_nitro = false;
    this.nitro_type = 0;
    this.premium_until = null;

    // Boost tracking
    this.boosts_used = 0;
    this.boosts_remaining = 2;
    this.last_boost = null;
    this.boost_history = [];

    // Health metrics
    this.health_score = 0; // 0-100
    this.verified = false;
    this.verification_errors = [];
    this.last_verification = null;
    this.error_count = 0;
    this.success_count = 0;

    // Humanization
    this.humanized = false;
    this.profile_customized = false;
    this.custom_username = null;
    this.custom_avatar = null;

    // Timing & activity
    this.created_at = Date.now();
    this.last_activity = null;
    this.locked = false;
    this.lock_reason = null;

    // Account strength indicators
    this.account_age_days = 0;
    this.raid_flagged = false;
    this.flags = 0;
  }

  generateId() {
    return Math.random().toString(36).substring(2, 10);
  }

  calculateHealthScore() {
    let score = 100;

    // Email verification (important)
    if (!this.email_verified) score -= 20;

    // Nitro status (critical)
    if (!this.has_nitro) score -= 30;

    // Account age (older = safer)
    if (this.account_age_days < 7) score -= 15;
    else if (this.account_age_days < 30) score -= 10;

    // Error history
    const errorRate = this.success_count > 0 
      ? this.error_count / (this.error_count + this.success_count)
      : 0;
    score -= errorRate * 25;

    // Boost usage
    if (this.boosts_remaining < 1) score -= 10;

    // Raid flags
    if (this.raid_flagged) score -= 50;

    this.health_score = Math.max(0, Math.min(100, score));
    return this.health_score;
  }

  isHealthy() {
    return this.health_score >= 60 && this.has_nitro && !this.locked;
  }

  canBoost() {
    return this.boosts_remaining > 0 && this.has_nitro && !this.locked;
  }

  recordSuccess() {
    this.success_count++;
    this.last_activity = Date.now();
  }

  recordError(error) {
    this.error_count++;
    this.verification_errors.push({
      error: error.message,
      timestamp: Date.now()
    });
    this.last_activity = Date.now();
  }

  getProfile() {
    return {
      id: this.id,
      email: this.email.split('@')[0] + '@***',
      username: this.username,
      userId: this.userId,
      health_score: this.health_score,
      verified: this.verified,
      has_nitro: this.has_nitro,
      boosts_remaining: this.boosts_remaining,
      humanized: this.humanized,
      locked: this.locked,
      error_count: this.error_count,
      success_count: this.success_count,
      account_age_days: this.account_age_days,
      last_activity: this.last_activity ? new Date(this.last_activity).toISOString() : null
    };
  }
}

class AccountManager {
  constructor(config = {}) {
    this.accounts = new Map();
    this.clients = new Map();
    this.config = {
      maxAccountsPerSession: 100,
      verifyOnAdd: true,
      enableHealthMonitoring: true,
      healthCheckInterval: 300000, // 5 minutes
      autoLockUnhealthy: true,
      healthThreshold: 40,
      ...config
    };
    this.stats = {
      totalAdded: 0,
      totalVerified: 0,
      totalBoosts: 0,
      totalErrors: 0
    };
    this.healthMonitorInterval = null;
  }

  async addAccount(email, password, token) {
    if (this.accounts.size >= this.config.maxAccountsPerSession) {
      return {
        success: false,
        error: `Maximum accounts (${this.config.maxAccountsPerSession}) reached`
      };
    }

    const profile = new AccountProfile(email, password, token);
    const client = new DiscordClient(token);

    try {
      // Verify token validity
      const verification = await client.verify();
      if (!verification.success) {
        return {
          success: false,
          error: `Token verification failed: ${verification.error}`
        };
      }

      // Extract user info
      profile.userId = verification.data.id;
      profile.username = verification.data.username;
      profile.email_verified = verification.data.verified;
      profile.flags = verification.data.flags || 0;
      profile.avatar = verification.data.avatar;

      // Check nitro status
      const nitroStatus = await client.getNitroStatus();
      profile.has_nitro = nitroStatus.hasNitro;
      profile.nitro_type = verification.data.premium_type || 0;

      // Get boost info
      const boostInfo = await client.getBoostInfo();
      profile.boosts_remaining = boostInfo.maxBoosts - boostInfo.usedBoosts;

      // Calculate account age (estimate from user ID timestamp)
      const userIdTimestamp = BigInt(profile.userId) >> BigInt(22);
      const accountAge = new Date(Number(userIdTimestamp));
      profile.account_age_days = Math.floor((Date.now() - accountAge) / (1000 * 60 * 60 * 24));

      profile.verified = true;
      profile.calculateHealthScore();

      this.accounts.set(profile.id, profile);
      this.clients.set(profile.id, client);
      this.stats.totalAdded++;
      this.stats.totalVerified++;

      // Start health monitoring
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      return {
        success: true,
        account_id: profile.id,
        profile: profile.getProfile()
      };

    } catch (error) {
      this.stats.totalErrors++;
      return {
        success: false,
        error: `Failed to add account: ${error.message}`
      };
    }
  }

  async verifyAccount(accountId) {
    const profile = this.accounts.get(accountId);
    if (!profile) {
      return { success: false, error: 'Account not found' };
    }

    const client = this.clients.get(accountId);
    if (!client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const verification = await client.verify();
      if (!verification.success) {
        profile.recordError(new Error(verification.error));
        profile.locked = true;
        profile.lock_reason = 'Token invalid or expired';
        return { success: false, error: verification.error };
      }

      profile.recordSuccess();
      profile.last_verification = Date.now();
      profile.calculateHealthScore();

      return {
        success: true,
        profile: profile.getProfile(),
        stats: client.getStats()
      };

    } catch (error) {
      profile.recordError(error);
      return { success: false, error: error.message };
    }
  }

  async boostServer(accountId, guildId, inviteCode) {
    const profile = this.accounts.get(accountId);
    if (!profile) {
      return { success: false, error: 'Account not found' };
    }

    if (!profile.canBoost()) {
      return {
        success: false,
        error: profile.locked ? 'Account locked' : 'No boosts remaining or no Nitro'
      };
    }

    const client = this.clients.get(accountId);
    if (!client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      // Join server first
      const joinResult = await client.joinServer(inviteCode);
      if (!joinResult.success) {
        profile.recordError(new Error(joinResult.error));
        return { success: false, error: `Failed to join server: ${joinResult.error}` };
      }

      // Apply boost
      const boostResult = await client.boostServer(joinResult.guildId);
      if (!boostResult.success) {
        profile.recordError(new Error(boostResult.error));
        return { success: false, error: `Failed to apply boost: ${boostResult.error}` };
      }

      // Record success
      profile.boosts_used++;
      profile.boosts_remaining = Math.max(0, profile.boosts_remaining - 1);
      profile.last_boost = Date.now();
      profile.boost_history.push({
        guildId: joinResult.guildId,
        timestamp: Date.now(),
        status: 'success'
      });
      profile.recordSuccess();
      profile.calculateHealthScore();
      this.stats.totalBoosts++;

      return {
        success: true,
        guildId: joinResult.guildId,
        boosts_remaining: profile.boosts_remaining,
        profile: profile.getProfile()
      };

    } catch (error) {
      profile.recordError(error);
      return { success: false, error: error.message };
    }
  }

  getAccount(accountId) {
    const profile = this.accounts.get(accountId);
    return profile ? profile.getProfile() : null;
  }

  getAllAccounts() {
    const accounts = [];
    for (const profile of this.accounts.values()) {
      accounts.push(profile.getProfile());
    }
    return accounts;
  }

  getHealthyAccounts(minBoosts = 1) {
    const healthy = [];
    for (const profile of this.accounts.values()) {
      if (profile.isHealthy() && profile.boosts_remaining >= minBoosts) {
        healthy.push(profile.getProfile());
      }
    }
    return healthy;
  }

  getAccountStats(accountId) {
    const profile = this.accounts.get(accountId);
    if (!profile) return null;

    const client = this.clients.get(accountId);
    return {
      profile: profile.getProfile(),
      clientStats: client ? client.getStats() : null,
      health: {
        score: profile.health_score,
        errorRate: profile.success_count > 0
          ? ((profile.error_count / (profile.error_count + profile.success_count)) * 100).toFixed(2)
          : '0',
        successCount: profile.success_count,
        errorCount: profile.error_count,
        lastErrors: profile.verification_errors.slice(-5)
      }
    };
  }

  startHealthMonitoring() {
    if (this.healthMonitorInterval) return;

    this.healthMonitorInterval = setInterval(async () => {
      for (const [accountId, profile] of this.accounts.entries()) {
        if (profile.locked) continue;

        const verification = await this.verifyAccount(accountId);
        
        // Auto-lock unhealthy accounts
        if (this.config.autoLockUnhealthy && profile.health_score < this.config.healthThreshold) {
          profile.locked = true;
          profile.lock_reason = `Health score below threshold (${profile.health_score})`;
        }
      }
    }, this.config.healthCheckInterval);
  }

  stopHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = null;
    }
  }

  removeAccount(accountId) {
    this.accounts.delete(accountId);
    this.clients.delete(accountId);
    return { success: true };
  }

  clearAll() {
    this.accounts.clear();
    this.clients.clear();
    this.stopHealthMonitoring();
    return { success: true };
  }

  getGlobalStats() {
    return {
      total_accounts: this.accounts.size,
      total_added: this.stats.totalAdded,
      total_verified: this.stats.totalVerified,
      total_boosts: this.stats.totalBoosts,
      total_errors: this.stats.totalErrors,
      healthy_accounts: this.getHealthyAccounts().length,
      locked_accounts: Array.from(this.accounts.values()).filter(a => a.locked).length
    };
  }
}

export { AccountManager, AccountProfile };
