// lib/discord-service.ts - Discord API client with resilience

import { Readable } from "stream";

interface TLSSession {
  headers: Record<string, string>;
  get: (url: string) => Promise<TLSResponse>;
  post: (url: string, json: any) => Promise<TLSResponse>;
  patch: (url: string, json: any) => Promise<TLSResponse>;
}

interface TLSResponse {
  status_code: number;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

interface BackoffConfig {
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  maxRetries: number;
}

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 1.5,
  maxRetries: 4,
};

const DISCORD_API_BASE = "https://discord.com/api/v9";

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  "origin": "https://discord.com",
  "priority": "u=1, i",
  "referer": "https://discord.com/channels",
  "sec-ch-ua": '"Google Chrome";v="140", "Chromium";v="140", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.249 Safari/537.36",
  "x-debug-options": "bugReporterEnabled",
  "x-discord-locale": "en-US",
  "x-discord-timezone": "Europe/London",
  "x-super-properties": Buffer.from(
    JSON.stringify({
      os: "Windows",
      browser: "Chrome",
      device: "",
      system_locale: "en-US",
      has_client_mods: false,
      browser_user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.249 Safari/537.36",
      browser_version: "140.0.7339.249",
      os_version: "10",
      referrer: "",
      referring_domain: "",
      referrer_current: "",
      referring_domain_current: "",
      release_channel: "stable",
      client_build_number: 480933,
      client_event_source: null,
      launch_signature: "ec044a01-c2a9-4517-8018-e106e8359421",
    })
  ).toString("base64"),
};

class DiscordAPIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isRateLimit: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "DiscordAPIError";
  }
}

class DiscordService {
  private tokenCache = new Map<string, { user: any; expiry: number }>();
  private rateLimitCache = new Map<string, { reset: number; remaining: number }>();

  async createSession(token: string): Promise<TLSSession> {
    // Dynamically import tls_client to avoid build issues
    let tlsClient: any;
    try {
      tlsClient = require("tls_client");
    } catch {
      throw new Error(
        "tls_client not available in this environment. Ensure Node.js runtime."
      );
    }

    const session = new tlsClient.Session(
      {
        client_identifier: "chrome_134",
        random_tls_extension_order: true,
      },
      undefined
    );

    const headers = {
      ...DEFAULT_HEADERS,
      authorization: token,
    };

    return {
      headers,
      get: async (url: string) => this.executeRequest(session, "GET", url, headers),
      post: async (url: string, json: any) =>
        this.executeRequest(session, "POST", url, headers, json),
      patch: async (url: string, json: any) =>
        this.executeRequest(session, "PATCH", url, headers, json),
    };
  }

  private async executeRequest(
    session: any,
    method: string,
    url: string,
    headers: Record<string, string>,
    json?: any
  ): Promise<TLSResponse> {
    const response =
      method === "GET"
        ? await session.get(url, { headers })
        : method === "POST"
          ? await session.post(url, { json, headers })
          : await session.patch(url, { json, headers });

    return {
      status_code: response.status_code || response.status || 200,
      text: async () => response.text || "",
      json: async () => {
        try {
          return JSON.parse(response.text || "{}");
        } catch {
          return {};
        }
      },
    };
  }

  private calculateBackoff(attempt: number, config: BackoffConfig): number {
    const delay = Math.min(
      config.initialDelay * Math.pow(config.multiplier, attempt),
      config.maxDelay
    );
    return Math.floor(delay + Math.random() * 100); // Add jitter
  }

  private async checkRateLimit(
    session: TLSSession,
    endpoint: string
  ): Promise<number | null> {
    const cached = this.rateLimitCache.get(endpoint);
    if (cached && cached.reset > Date.now()) {
      return cached.remaining;
    }
    return null;
  }

  private async updateRateLimit(
    response: TLSResponse,
    endpoint: string
  ): Promise<void> {
    const remaining = response.status_code === 429 ? 0 : 49;
    const reset = Date.now() + (response.status_code === 429 ? 60000 : 60000);
    this.rateLimitCache.set(endpoint, { reset, remaining });
  }

  async validateToken(token: string): Promise<boolean> {
    const cacheKey = `validate:${token}`;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return true;
    }

    let session: TLSSession | null = null;

    try {
      session = await this.createSession(token);
      const response = await this.makeRequest(
        session,
        "GET",
        `${DISCORD_API_BASE}/users/@me`
      );

      if (response.status_code === 401) {
        return false;
      }

      if (response.status_code === 200) {
        const user = await response.json();
        this.tokenCache.set(cacheKey, {
          user,
          expiry: Date.now() + 3600000, // 1 hour
        });
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async getUser(token: string): Promise<any> {
    const session = await this.createSession(token);
    const response = await this.makeRequest(
      session,
      "GET",
      `${DISCORD_API_BASE}/users/@me`,
      DEFAULT_BACKOFF
    );

    if (response.status_code === 401) {
      throw new DiscordAPIError(401, "Invalid token", false);
    }

    if (response.status_code === 403) {
      throw new DiscordAPIError(403, "Account locked or suspended", false);
    }

    return await response.json();
  }

  async getSubscriptions(token: string): Promise<any[]> {
    const session = await this.createSession(token);
    const response = await this.makeRequest(
      session,
      "GET",
      `${DISCORD_API_BASE}/users/@me/billing/subscriptions`,
      DEFAULT_BACKOFF
    );

    if (response.status_code === 401) {
      throw new DiscordAPIError(401, "Invalid token", false);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getBoostSlots(token: string): Promise<number> {
    const session = await this.createSession(token);
    const response = await this.makeRequest(
      session,
      "GET",
      `${DISCORD_API_BASE}/users/@me/guilds/premium/subscription-slots`,
      DEFAULT_BACKOFF
    );

    if (response.status_code === 401) {
      throw new DiscordAPIError(401, "Invalid token", false);
    }

    const slots = await response.json();
    return Array.isArray(slots)
      ? slots.filter((s) => s.cooldown_ends_at === null).length
      : 0;
  }

  async enrollQuest(token: string, questId: string): Promise<boolean> {
    const session = await this.createSession(token);
    const response = await this.makeRequest(
      session,
      "POST",
      `${DISCORD_API_BASE}/quests/${questId}/enroll`,
      DEFAULT_BACKOFF,
      {
        location: 11,
        is_targeted: false,
        metadata_raw: null,
      }
    );

    if (response.status_code === 401) {
      throw new DiscordAPIError(401, "Invalid token", false);
    }

    if (response.status_code === 404) {
      throw new DiscordAPIError(404, "Quest not found", false);
    }

    return response.status_code === 200;
  }

  async completeQuest(token: string, questId: string): Promise<boolean> {
    const session = await this.createSession(token);

    // Progress loop
    let timestamp = 1;
    let completed = false;

    while (!completed && timestamp < 500) {
      const progressResponse = await this.makeRequest(
        session,
        "POST",
        `${DISCORD_API_BASE}/quests/${questId}/video-progress`,
        {
          ...DEFAULT_BACKOFF,
          maxRetries: 2,
        },
        { timestamp }
      );

      if (progressResponse.status_code === 401) {
        throw new DiscordAPIError(401, "Invalid token", false);
      }

      const progressData = await progressResponse.json();
      if (progressData.completed_at) {
        completed = true;
        break;
      }

      timestamp += 5;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (!completed) {
      throw new DiscordAPIError(
        500,
        "Quest progress timed out",
        false
      );
    }

    // Accept agreements
    const agreementsResponse = await this.makeRequest(
      session,
      "PATCH",
      `${DISCORD_API_BASE}/users/@me/agreements`,
      DEFAULT_BACKOFF,
      { terms: true, privacy: true }
    );

    if (agreementsResponse.status_code === 401) {
      throw new DiscordAPIError(401, "Invalid token", false);
    }

    return true;
  }

  private async makeRequest(
    session: TLSSession,
    method: string,
    url: string,
    backoffConfig: BackoffConfig = DEFAULT_BACKOFF,
    payload?: any
  ): Promise<TLSResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= backoffConfig.maxRetries; attempt++) {
      try {
        let response: TLSResponse;

        if (method === "GET") {
          response = await session.get(url);
        } else if (method === "POST") {
          response = await session.post(url, payload || {});
        } else if (method === "PATCH") {
          response = await session.patch(url, payload || {});
        } else {
          throw new Error(`Unsupported method: ${method}`);
        }

        // Handle rate limit
        if (response.status_code === 429) {
          if (attempt < backoffConfig.maxRetries) {
            const delay = this.calculateBackoff(attempt, backoffConfig);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            throw new DiscordAPIError(
              429,
              "Rate limit exceeded",
              true,
              60
            );
          }
        }

        // Handle network errors
        if (response.status_code >= 500) {
          if (attempt < backoffConfig.maxRetries) {
            const delay = this.calculateBackoff(attempt, backoffConfig);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            throw new DiscordAPIError(
              response.status_code,
              "Discord server error",
              false
            );
          }
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        if (attempt < backoffConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt, backoffConfig);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw (
      lastError ||
      new DiscordAPIError(500, "Request failed after retries", false)
    );
  }
}

export const discordService = new DiscordService();
export { DiscordAPIError };
