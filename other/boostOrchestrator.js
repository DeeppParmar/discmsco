// lib/boostOrchestrator.js - Expert boost orchestration with scheduling
import crypto from 'crypto';

class BoostSession {
  constructor(serverLink, boostCount, config = {}) {
    this.id = crypto.randomBytes(8).toString('hex');
    this.serverLink = serverLink;
    this.inviteCode = this.extractInviteCode(serverLink);
    this.requestedBoosts = boostCount;
    
    this.status = 'initialized'; // initialized -> pending -> running -> completed/failed
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = 0;

    this.results = {
      successful: 0,
      failed: 0,
      pending: boostCount,
      retried: 0,
      total_attempts: 0
    };

    this.boosts = [];
    this.errors = [];
    this.logs = [];
    this.config = {
      maxRetries: 3,
      concurrentLimit: 5,
      timeout: 60000,
      adaptiveSpacing: true,
      ...config
    };

    this.log('Session initialized', { boostCount, serverLink: this.inviteCode });
  }

  extractInviteCode(link) {
    if (link.includes('discord.gg/')) {
      return link.split('discord.gg/')[1].split(/[/?#]/)[0];
    }
    if (link.includes('discord.com/invite/')) {
      return link.split('discord.com/invite/')[1].split(/[/?#]/)[0];
    }
    return link;
  }

  log(message, data = null) {
    const entry = {
      timestamp: Date.now(),
      message,
      data
    };
    this.logs.push(entry);
  }

  recordBoost(accountId, status, error = null) {
    const boost = {
      accountId,
      status,
      error,
      timestamp: Date.now(),
      retries: 0
    };
    this.boosts.push(boost);

    if (status === 'success') {
      this.results.successful++;
      this.results.pending--;
      this.log(`Boost successful`, { accountId });
    } else if (status === 'failed') {
      this.results.failed++;
      this.results.pending--;
      this.errors.push({ accountId, error, timestamp: Date.now() });
      this.log(`Boost failed`, { accountId, error: error?.message });
    } else if (status === 'pending') {
      this.log(`Boost pending`, { accountId });
    }

    this.results.total_attempts++;
  }

  getProgress() {
    return {
      status: this.status,
      progress: this.results.successful + this.results.failed,
      total: this.requestedBoosts,
      successful: this.results.successful,
      failed: this.results.failed,
      pending: this.results.pending,
      percentage: Math.round((this.results.successful + this.results.failed) / this.requestedBoosts * 100)
    };
  }

  finish(status = 'completed') {
    this.status = status;
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.log(`Session ${status}`, { duration: this.duration });
  }

  getSummary() {
    return {
      sessionId: this.id,
      status: this.status,
      inviteCode: this.inviteCode,
      requested: this.requestedBoosts,
      successful: this.results.successful,
      failed: this.results.failed,
      retried: this.results.retried,
      totalAttempts: this.results.total_attempts,
      duration: this.duration,
      startTime: this.startTime,
      endTime: this.endTime,
      errorCount: this.errors.length,
      topErrors: this.getTopErrors(5)
    };
  }

  getTopErrors(limit = 5) {
    const errorMap = new Map();
    for (const error of this.errors) {
      const msg = error.error?.message || 'Unknown error';
      errorMap.set(msg, (errorMap.get(msg) || 0) + 1);
    }
    return Array.from(errorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }
}

class BoostOrchestrator {
  constructor(accountManager, config = {}) {
    this.accountManager = accountManager;
    this.sessions = new Map();
    this.activeBoosts = new Map();
    this.config = {
      maxConcurrentSessions: 10,
      requestedBoostTimeout: 120000,
      ...config
    };
  }

  selectOptimalAccounts(boostCount) {
    // Get healthy accounts sorted by optimal criteria
    const candidates = this.accountManager.getHealthyAccounts(1);
    
    // Sort by health score (descending)
    candidates.sort((a, b) => {
      // Prioritize: boosts remaining > health score > low error rate
      if (b.boosts_remaining !== a.boosts_remaining) {
        return b.boosts_remaining - a.boosts_remaining;
      }
      return b.health_score - a.health_score;
    });

    return candidates.slice(0, boostCount);
  }

  async executeSession(serverLink, boostCount) {
    const session = new BoostSession(serverLink, boostCount, this.config);

    // Validate invite code
    if (!session.inviteCode || session.inviteCode.length < 2) {
      session.log('Invalid invite code');
      session.finish('failed');
      return { success: false, error: 'Invalid server link', sessionId: session.id };
    }

    // Select accounts
    const selectedAccounts = this.selectOptimalAccounts(boostCount);
    if (selectedAccounts.length === 0) {
      session.log('No healthy accounts available');
      session.finish('failed');
      return { success: false, error: 'No healthy accounts available', sessionId: session.id };
    }

    session.log('Accounts selected', { count: selectedAccounts.length });
    session.status = 'pending';
    this.sessions.set(session.id, session);

    // Start async boost execution
    this.executeBoostsAsync(session, selectedAccounts)
      .catch(error => {
        session.log('Execution error', { error: error.message });
        session.finish('failed');
      });

    return {
      success: true,
      sessionId: session.id,
      selectedAccounts: selectedAccounts.length,
      message: `${selectedAccounts.length} accounts queued for boost`
    };
  }

  async executeBoostsAsync(session, selectedAccounts) {
    session.status = 'running';
    session.log('Boost execution started', { accountCount: selectedAccounts.length });

    // Process in concurrent batches
    const batchSize = session.config.concurrentLimit;
    
    for (let i = 0; i < selectedAccounts.length; i += batchSize) {
      const batch = selectedAccounts.slice(i, i + batchSize);
      const promises = batch.map((account, index) => 
        this.executeBoostWithRetry(session, account.id, index)
      );

      await Promise.allSettled(promises);

      // Adaptive spacing between batches
      if (i + batchSize < selectedAccounts.length) {
        const delay = session.config.adaptiveSpacing 
          ? 2000 + Math.random() * 3000
          : 2000;
        await this.sleep(delay);
      }
    }

    session.finish('completed');
    session.log('All boosts processed');
  }

  async executeBoostWithRetry(session, accountId, batchIndex) {
    let lastError = null;
    let retries = 0;

    for (retries = 0; retries < session.config.maxRetries; retries++) {
      try {
        session.recordBoost(accountId, 'pending');

        // Add staggered delays within batch
        const delay = 500 + (batchIndex * 300) + Math.random() * 500;
        await this.sleep(delay);

        // Execute boost
        const result = await this.accountManager.boostServer(
          accountId,
          'guild-placeholder', // GuildID extracted in accountManager
          session.inviteCode
        );

        if (result.success) {
          session.recordBoost(accountId, 'success');
          this.activeBoosts.set(accountId, Date.now());
          return { success: true, accountId };
        } else {
          lastError = result.error;
          
          // Check if error is retryable
          if (this.isRetryableError(result.error) && retries < session.config.maxRetries - 1) {
            session.results.retried++;
            const backoffDelay = Math.pow(2, retries) * 1000 + Math.random() * 500;
            await this.sleep(backoffDelay);
            continue;
          }

          session.recordBoost(accountId, 'failed', new Error(result.error));
          return { success: false, accountId, error: result.error };
        }
      } catch (error) {
        lastError = error;

        if (retries < session.config.maxRetries - 1) {
          const backoffDelay = Math.pow(2, retries) * 1000 + Math.random() * 500;
          await this.sleep(backoffDelay);
          continue;
        }

        session.recordBoost(accountId, 'failed', error);
        return { success: false, accountId, error: error.message };
      }
    }

    return { success: false, accountId, error: lastError?.message || 'Max retries exceeded' };
  }

  isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'rate limit',
      'temporarily unavailable',
      'timeout'
    ];
    
    const errorStr = String(error).toLowerCase();
    return retryableErrors.some(err => errorStr.includes(err));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }

    return {
      ...session.getProgress(),
      sessionId: session.id,
      startTime: new Date(session.startTime).toISOString(),
      endTime: session.endTime ? new Date(session.endTime).toISOString() : null,
      duration: session.duration
    };
  }

  getSessionSummary(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return session.getSummary();
  }

  getSessionLogs(sessionId, limit = 50) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.logs.slice(-limit).map(log => ({
      ...log,
      timestamp: new Date(log.timestamp).toISOString()
    }));
  }

  getAllSessions() {
    const sessions = [];
    for (const session of this.sessions.values()) {
      sessions.push(session.getSummary());
    }
    return sessions.sort((a, b) => b.startTime - a.startTime);
  }

  getOrchestrationStats() {
    let totalBoosts = 0;
    let successfulBoosts = 0;
    let failedBoosts = 0;
    let totalDuration = 0;

    for (const session of this.sessions.values()) {
      totalBoosts += session.requestedBoosts;
      successfulBoosts += session.results.successful;
      failedBoosts += session.results.failed;
      totalDuration += session.duration;
    }

    return {
      totalSessions: this.sessions.size,
      totalBoosts,
      successfulBoosts,
      failedBoosts,
      successRate: totalBoosts > 0 
        ? (successfulBoosts / totalBoosts * 100).toFixed(2) + '%'
        : '0%',
      averageBoostsPerSession: this.sessions.size > 0
        ? (totalBoosts / this.sessions.size).toFixed(2)
        : '0',
      totalDuration,
      averageSessionDuration: this.sessions.size > 0
        ? (totalDuration / this.sessions.size).toFixed(0) + 'ms'
        : '0ms'
    };
  }

  clearOldSessions(ageMs = 3600000) { // 1 hour default
    const now = Date.now();
    const toDelete = [];

    for (const [id, session] of this.sessions.entries()) {
      if (session.endTime && (now - session.endTime) > ageMs) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.sessions.delete(id));
    return { deleted: toDelete.length };
  }
}

export { BoostOrchestrator, BoostSession };
