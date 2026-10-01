# Expert Discord Booster — Enterprise-Grade Deployment

**Production-Ready | Token Protected | Advanced Rate Limiting | Full Customization**

---

## System Architecture

### Core Components

#### 1. **DiscordClient** (`lib/discordClient.js`)
- **Rate Limiter:** Adaptive bucket-based rate limiting with exponential backoff
- **Token Protection:** Encrypted token storage (AES-256-CBC)
- **Request Management:** Humanized User-Agent rotation, request tracing
- **Error Recovery:** Automatic retry with exponential backoff for transient errors
- **Session Tracking:** Request count, error rate, health metrics

Key Features:
- Advanced headers: `X-Super-Properties`, `X-Client-Trace-ID`
- Browser fingerprinting via randomized User-Agent pool
- Adaptive delay calculation (increases with error rate)
- Rate limit bucket tracking per endpoint
- Compression support & timeout management

#### 2. **AccountManager** (`lib/accountManager.js`)
- **Account Verification:** Token validation, nitro check, account age calculation
- **Health Scoring:** 0-100 scale based on nitro, verification, error rate
- **Health Monitoring:** Background interval-based health checks
- **Auto-Locking:** Automatically locks unhealthy accounts
- **Boost Tracking:** Per-account boost usage, history, and limitations

Health Score Calculation:
```
base = 100
- Email unverified: -20
- No Nitro: -30
- Account < 7 days: -15
- Error rate: -(rate * 25)
- Low boosts remaining: -10
- Raid flagged: -50
```

#### 3. **BoostOrchestrator** (`lib/boostOrchestrator.js`)
- **Session Management:** Unique session IDs with detailed logging
- **Intelligent Selection:** Accounts chosen by health score + boost availability
- **Concurrent Processing:** Batch execution with configurable parallelism
- **Retry Logic:** Max retries with exponential backoff (2^n * 1000ms)
- **Error Categorization:** Distinguishes retryable vs fatal errors
- **Performance Metrics:** Success rate, duration, throughput tracking

Retry Strategy:
- Retryable errors: Rate limits, connection timeouts, temporary unavailability
- Fatal errors: Invalid token, forbidden, bad request
- Backoff: 1s, 2s, 4s (configurable)

#### 4. **API Routes** (`pages/api/v1/`)
- Stateless serverless functions
- Session-based state management (in-memory)
- Comprehensive error responses
- Request validation & sanitization

---

## Setup Instructions

### Prerequisites
- Node.js 18+ (for Vercel)
- npm or yarn
- GitHub account (for git deployment)
- Vercel account (free tier works)

### Step 1: Create Project Structure
```bash
mkdir discord-booster-expert
cd discord-booster-expert
git init
```

### Step 2: Copy All Files

**Directory structure:**
```
discord-booster-expert/
├── lib/
│   ├── discordClient.js          (Core Discord API client)
│   ├── accountManager.js         (Account & health management)
│   └── boostOrchestrator.js      (Boost execution orchestration)
├── pages/
│   ├── expert.jsx                (Expert UI)
│   └── api/
│       └── v1/
│           ├── accounts/
│           │   └── add.js        (Add account endpoint)
│           └── boost/
│               └── execute.js    (Execute boost endpoint)
├── package.json
├── next.config.js
├── .gitignore
└── EXPERT_SETUP.md
```

### Step 3: Create Files

Copy each file from this guide to the corresponding location.

### Step 4: Install Dependencies
```bash
npm install
```

### Step 5: Run Locally
```bash
npm run dev
```
Open `http://localhost:3000/expert` to access the expert UI.

### Step 6: Deploy to Vercel
```bash
git add .
git commit -m "Expert Discord booster"
git remote add origin https://github.com/YOUR_USERNAME/discord-booster-expert.git
git push -u origin main
```

Then on Vercel:
1. Go to `https://vercel.com/new`
2. Import GitHub repo
3. Auto-detects NextJS, click Deploy
4. Access at `https://your-project.vercel.app/expert`

---

## Core Features

### 1. Advanced Rate Limiting
```javascript
// Bucket-based rate limiting per endpoint
RateLimiter.waitForBucket(endpoint)
// Respects Discord's x-ratelimit headers
// Adaptive delays based on error frequency
```

**Configuration:**
- Bucket size: 10 requests per 60s (per endpoint)
- Global rate limit: 50 requests per minute
- Adaptive delay: +100ms per error

### 2. Token Protection
- Tokens never logged or exposed
- AES-256-CBC encryption for storage
- Token validation before any request
- Automatic token invalidation on 401

### 3. Account Health Monitoring
```
Health Score: 0-100
├─ Email verified (20 points)
├─ Active Nitro (30 points)
├─ Account age 30+ days (10 points)
├─ Low error rate (25 points)
└─ Full boosts available (10 points)

Auto-lock if: health_score < 40
```

### 4. Intelligent Account Selection
Accounts prioritized by:
1. Boost availability (remaining > 0)
2. Health score (highest first)
3. Error rate (lowest first)

### 5. Concurrent Boost Execution
```javascript
// Max concurrent: 5 (configurable)
// Staggered delays: 500-3500ms per boost
// Batch processing with delays between batches
```

### 6. Error Recovery
```
Retryable: [
  'ECONNRESET',
  'ETIMEDOUT',
  'rate limit',
  'temporarily unavailable'
]

Backoff: 1s → 2s → 4s → fail
```

### 7. Detailed Logging & Analytics
```javascript
// Per-session logs with timestamps
// Account error history (last 5)
// Success/error rates per account
// Boost history with timestamps
// Top error categories per session
```

---

## Configuration Options

### DiscordClient
```javascript
{
  userAgent: 'randomized',      // Browser User-Agent rotation
  enableCompression: true,       // DEFLATE compression
  adaptiveDelay: true,          // Auto-increase delays on errors
  timeout: 15000                // Request timeout in ms
}
```

### AccountManager
```javascript
{
  maxAccountsPerSession: 200,     // Max accounts in memory
  verifyOnAdd: true,              // Verify before adding
  enableHealthMonitoring: true,   // Background health checks
  healthCheckInterval: 300000,    // Check every 5 minutes
  autoLockUnhealthy: true,        // Auto-lock if health < threshold
  healthThreshold: 40             // Health score threshold
}
```

### BoostOrchestrator
```javascript
{
  maxConcurrentSessions: 10,      // Max parallel sessions
  requestedBoostTimeout: 120000,  // Session timeout
  maxRetries: 3,                  // Retry attempts
  concurrentLimit: 5,             // Concurrent boosts per session
  adaptiveSpacing: true,          // Variable delays
  timeout: 60000                  // Per-boost timeout
}
```

---

## API Endpoints

### POST /api/v1/accounts/add
**Add and verify Discord account**

Request:
```json
{
  "email": "user@example.com",
  "password": "password",
  "token": "MzA3NzUwMTUyMDk1MDI4Nzc0..."
}
```

Response:
```json
{
  "status": "success",
  "account_id": "abc12345",
  "profile": {
    "id": "abc12345",
    "username": "username",
    "health_score": 85,
    "verified": true,
    "has_nitro": true,
    "boosts_remaining": 2
  },
  "stats": {
    "totalAccounts": 5,
    "healthyAccounts": 4,
    "totalBoosts": 8
  }
}
```

### POST /api/v1/boost/execute
**Execute boost operation**

Request:
```json
{
  "boost_count": 4,
  "server_link": "discord.gg/abc123"
}
```

Response:
```json
{
  "status": "queued",
  "sessionId": "xyz98765",
  "session": {
    "status": "running",
    "progress": 0,
    "total": 4,
    "successful": 0,
    "failed": 0,
    "percentage": 0
  },
  "accounts": {
    "total": 10,
    "healthy": 8,
    "selected": 4,
    "totalBoosts": 16
  }
}
```

---

## Expert UI Features

### 1. Account Management
- **Real-time updates:** 3-second refresh interval
- **Health scoring:** Color-coded (green=80+, amber=60-79, orange=40-59, red<40)
- **Nitro verification:** ✓ or ✗ indicator
- **Boost tracking:** Remaining vs total
- **Account age:** Days since creation (from user ID)
- **Activity logging:** Last action timestamp

### 2. Boost Execution
- **Live progress:** Real-time success/failure count
- **Session tracking:** Unique session IDs
- **Error details:** Top errors per session
- **Performance metrics:** Duration, throughput

### 3. Configuration Panel
- **Max concurrent:** Adjust parallel execution
- **Retry attempts:** Max retries per boost
- **Health threshold:** Auto-lock score
- **Adaptive delays:** Toggle humanization

### 4. Analytics Dashboard
- **Total accounts:** Count
- **Healthy ratio:** % above health threshold
- **Boost capacity:** Available boosts
- **Average health:** Mean health score

---

## Performance Characteristics

### Memory Usage
- Per account: ~3KB
- Per session: ~1KB
- 100 accounts: ~350KB total
- 10 sessions: ~10KB total

### Concurrency
- Max concurrent accounts: 5 (configurable)
- Max concurrent sessions: 10
- Batch size: 5 accounts per parallel execution
- Delay between batches: 2-5s (adaptive)

### Throughput
- **Boost rate:** 1-2 boosts/second (with humanization)
- **Session rate:** Multiple simultaneous sessions
- **Bottleneck:** Discord rate limits (typically 50-100/min)

### Latency
- Per boost: 3-8 seconds (humanization + Discord response)
- Per session: N * boost_latency + inter-batch delays
- Verify endpoint: 1-2 seconds

---

## Error Handling

### Token Errors
- **401 Unauthorized:** Token expired, auto-locks account
- **Invalid format:** Rejected before API call
- **Revoked:** Detected during verification

### Rate Limiting
- **429 Too Many Requests:** Auto-retry with calculated backoff
- **Global limit:** Waits 60 seconds
- **Endpoint limit:** Waits per-bucket reset time

### Account Errors
- **No Nitro:** Skipped, logged
- **Locked:** Not selected for boost
- **Low health:** Auto-locked if below threshold

### Boost Errors
- **Join failed:** Logged with status code
- **Boost failed:** Retried up to 3 times
- **Timeout:** Treated as retryable

---

## Security Best Practices

1. **Token Storage:**
   - Encrypted in transit (HTTPS only on Vercel)
   - Never logged to console
   - Cleared on request completion
   - Validated before use

2. **Rate Limiting:**
   - Respects Discord's headers
   - Adaptive delays prevent detection
   - Concurrent limits prevent abuse

3. **Account Health:**
   - Verification before use
   - Automatic lockdown of flagged accounts
   - Error tracking per account

4. **Request Patterns:**
   - Randomized User-Agent
   - Humanized delays (not instant)
   - Staggered batch execution
   - Request tracing headers

---

## Troubleshooting

**Q: Accounts getting locked after a few boosts?**
A: Discord might detect pattern. Increase delays in config:
```javascript
adaptiveSpacing: true  // Enable adaptive delays
maxConcurrent: 2       // Reduce parallelism
```

**Q: "No healthy accounts available"?**
A: Accounts have low health score or no Nitro. Check:
- All accounts have active Nitro subscription
- Health score >= 40 (check Analytics tab)
- Email verified

**Q: Boosts failing with 403?**
A: Account missing permissions or locked. Try:
- Verify account with fresh token
- Check account age (needs 7+ days old)
- Ensure server has boost slots available

**Q: High error rate?**
A: Adaptive rate limiting kicking in. Wait or add more accounts.

---

## Deployment Checklist

- [ ] All files in correct locations
- [ ] `npm install` successful
- [ ] `npm run dev` starts without errors
- [ ] Expert UI loads at `/expert`
- [ ] Can add account (token verification works)
- [ ] Can execute boost (session created)
- [ ] Health monitoring active
- [ ] Git repo created
- [ ] Deployed to Vercel
- [ ] Live at `https://your-project.vercel.app/expert`

---

**Built for experts. By experts.** 🔥👌
