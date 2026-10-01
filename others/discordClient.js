// lib/discordClient.js - Expert-level Discord API client with token protection
import crypto from 'crypto';

const DISCORD_API = 'https://discord.com/api/v9';
const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 3;

// Advanced rate limiting with adaptive backoff
class RateLimiter {
  constructor() {
    this.buckets = new Map();
    this.globalReset = 0;
    this.adaptiveDelay = 500; // Start at 500ms
  }

  async waitForBucket(endpoint) {
    const now = Date.now();
    
    if (now < this.globalReset) {
      const waitTime = this.globalReset - now;
      await this.delay(waitTime + 100);
    }

    if (!this.buckets.has(endpoint)) {
      this.buckets.set(endpoint, { remaining: 10, reset: now + 60000 });
    }

    const bucket = this.buckets.get(endpoint);

    if (now > bucket.reset) {
      bucket.remaining = 10;
      bucket.reset = now + 60000;
    }

    if (bucket.remaining <= 0) {
      const waitTime = bucket.reset - now;
      await this.delay(waitTime + 50);
      bucket.remaining = 10;
    }

    bucket.remaining--;
    return bucket;
  }

  updateFromHeaders(headers, endpoint) {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '10');
    const reset = parseInt(headers['x-ratelimit-reset-after'] || '0');

    if (!this.buckets.has(endpoint)) {
      this.buckets.set(endpoint, { remaining: 10, reset: Date.now() + 60000 });
    }

    const bucket = this.buckets.get(endpoint);
    bucket.remaining = Math.max(0, remaining - 1);

    if (reset > 0) {
      bucket.reset = Date.now() + (reset * 1000);
    }

    if (headers['x-ratelimit-global']) {
      this.globalReset = Date.now() + 60000;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Token encryption/decryption for secure storage
class TokenVault {
  constructor(masterKey = 'default-vault-key-change-this') {
    this.masterKey = crypto.createHash('sha256').update(masterKey).digest();
  }

  encryptToken(token) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  decryptToken(encryptedToken) {
    const [ivHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.masterKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Advanced Discord API client
class DiscordClient {
  constructor(token, options = {}) {
    this.token = token;
    this.rateLimiter = new RateLimiter();
    this.tokenVault = new TokenVault();
    this.session = {
      userId: null,
      username: null,
      email: null,
      premium: false,
      verified: false,
      flags: 0,
      createdAt: Date.now()
    };
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastActivity = Date.now();
    this.options = {
      userAgent: this.randomUserAgent(),
      enableCompression: true,
      adaptiveDelay: true,
      ...options
    };
    this.cache = new Map();
  }

  async request(method, endpoint, data = null, retries = 0) {
    try {
      const url = `${DISCORD_API}${endpoint}`;
      const headers = this.buildHeaders();

      // Wait for rate limit bucket
      await this.rateLimiter.waitForBucket(endpoint);

      // Add humanization delays
      const delayMs = this.calculateDelay();
      await this.sleep(delayMs);

      const options = {
        method,
        headers,
        timeout: REQUEST_TIMEOUT
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      
      // Update rate limiter from response headers
      this.rateLimiter.updateFromHeaders(response.headers, endpoint);

      // Handle responses
      if (response.ok) {
        this.requestCount++;
        this.lastActivity = Date.now();
        return await response.json();
      }

      // Handle specific error codes
      if (response.status === 401) {
        throw new Error('INVALID_TOKEN: Token expired or revoked');
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        await this.sleep((parseInt(retryAfter) || 30) * 1000 + Math.random() * 1000);
        return this.request(method, endpoint, data, retries + 1);
      }

      if (response.status === 403) {
        throw new Error('FORBIDDEN: Missing permissions');
      }

      if (response.status >= 500 && retries < MAX_RETRIES) {
        await this.sleep(1000 * (retries + 1) + Math.random() * 1000);
        return this.request(method, endpoint, data, retries + 1);
      }

      this.errorCount++;
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API_ERROR_${response.status}: ${errorData.message || 'Unknown error'}`);

    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  buildHeaders() {
    return {
      'Authorization': this.token,
      'User-Agent': this.options.userAgent,
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'X-Super-Properties': this.generateSuperProperties(),
      'X-Client-Trace-ID': this.generateTraceId()
    };
  }

  generateSuperProperties() {
    const props = {
      os: 'Windows',
      browser: 'Chrome',
      device: '',
      system_locale: 'en-US',
      browser_user_agent: this.options.userAgent,
      browser_version: '120.0.0.0',
      os_version: '10',
      referrer: '',
      referring_domain: '',
      referrer_current: '',
      referring_domain_current: '',
      release_channel: 'stable',
      client_build_number: 320881,
      client_event_source: null
    };
    return Buffer.from(JSON.stringify(props)).toString('base64');
  }

  generateTraceId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  calculateDelay() {
    if (!this.options.adaptiveDelay) {
      return Math.random() * 2000 + 500;
    }
    // Adaptive: increase delay if getting rate limited
    const baseDelay = 500 + (this.errorCount * 100);
    return Math.random() * baseDelay + 200;
  }

  randomUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Verify token and get user info
  async verify() {
    try {
      const user = await this.request('GET', '/users/@me');
      this.session.userId = user.id;
      this.session.username = user.username;
      this.session.email = user.email;
      this.session.verified = user.verified;
      this.session.premium = (user.premium_type || 0) > 0;
      this.session.flags = user.flags || 0;
      return { success: true, data: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get nitro subscription status
  async getNitroStatus() {
    if (!this.session.premium) {
      return { hasNitro: false, reason: 'No premium flag' };
    }

    try {
      const subscriptions = await this.request('GET', '/users/@me/billing/subscriptions');
      const hasActiveNitro = subscriptions && subscriptions.length > 0;
      return { 
        hasNitro: hasActiveNitro, 
        subscriptions: subscriptions || [],
        lastCheck: Date.now()
      };
    } catch (error) {
      return { hasNitro: false, error: error.message };
    }
  }

  // Get boost status
  async getBoostInfo() {
    try {
      const guilds = await this.request('GET', '/users/@me/guilds?with_counts=true');
      let totalBoosts = 0;
      let usedBoosts = 0;

      // Parse boost info from guild membership
      for (const guild of guilds || []) {
        if (guild.premium_subscription_count > 0) {
          totalBoosts++;
        }
      }

      return { totalBoosts, usedBoosts, maxBoosts: 2 };
    } catch (error) {
      return { totalBoosts: 0, usedBoosts: 0, maxBoosts: 2, error: error.message };
    }
  }

  // Join server
  async joinServer(inviteCode) {
    try {
      const result = await this.request('POST', `/invites/${inviteCode}`);
      return { success: true, guildId: result.guild.id, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Apply boost to server
  async boostServer(guildId) {
    try {
      // First verify nitro
      const nitro = await this.getNitroStatus();
      if (!nitro.hasNitro) {
        return { success: false, error: 'No active Nitro subscription' };
      }

      const result = await this.request('POST', `/guilds/${guildId}/premium/subscriptions`);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Health check
  async healthCheck() {
    return {
      alive: this.session.userId !== null,
      uptime: Date.now() - this.session.createdAt,
      requests: this.requestCount,
      errors: this.errorCount,
      lastActivity: this.lastActivity,
      session: this.session
    };
  }

  // Get session stats
  getStats() {
    return {
      userId: this.session.userId,
      username: this.session.username,
      email: this.session.email,
      hasNitro: this.session.premium,
      verified: this.session.verified,
      requestsMade: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%' : '0%',
      lastActivity: new Date(this.lastActivity).toISOString()
    };
  }
}

export { DiscordClient, RateLimiter, TokenVault };
