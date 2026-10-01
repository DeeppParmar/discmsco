# Discord Multi-Tool | Serverless Dashboard

A production-grade, serverless Discord account management tool built with **Next.js**, **Vercel**, **Inngest**, and **TypeScript**. Validate, check, and manage Discord accounts with advanced security gates and real-time processing.

## 🚀 Features

### ✅ Core Capabilities
- **Token Validation** - Multi-gate validation pipeline (format → structure → content)
- **Account Checking** - Verify account status, flags, Nitro, age, email/phone verification
- **Quest Operations** - Complete and claim Discord quests with automatic retry logic
- **Real-Time Processing** - WebSocket-based job status updates
- **Batch Operations** - Process multiple tokens concurrently with rate limiting

### 🔐 Security Features
- **Encryption at Rest** - AES-256-CBC encryption for sensitive data
- **Token Hashing** - SHA-256 hashing, tokens never logged
- **Rate Limiting** - 50 ops/minute per token, per-request validation
- **Security Gates** - Pre-execution validation before any API call
- **Session Management** - 24-hour encrypted session storage
- **Operation Locking** - Prevent duplicate concurrent operations

### 🏗️ Architecture
- **Serverless** - Vercel Edge Runtime with no cold-start penalties
- **Job Queue** - Inngest for reliable async task processing
- **Database** - Vercel KV (Redis) for session and state management
- **Type-Safe** - Full TypeScript implementation with strict mode
- **Resilient** - Exponential backoff, retry logic, error handling

---

## 📋 Prerequisites

- **Node.js** ≥18.0.0
- **npm** or **yarn**
- **Vercel Account** (for deployment)
- **Inngest Account** (for job queue)
- **Upstash Redis** (Vercel KV) account

---

## 🛠️ Installation

### 1. Clone & Setup

```bash
# Clone repository
git clone <repo-url>
cd discord-multi-tool

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your actual credentials:

```bash
# Vercel KV
KV_URL=https://[your-instance].upstash.io
KV_REST_API_URL=https://[your-instance].upstash.io
KV_REST_API_TOKEN=[your-token]

# Inngest
INNGEST_EVENT_KEY=evt_prod_[your-key]
INNGEST_BASE_URL=https://inngest.com

# Encryption (generate: openssl rand -base64 32)
ENCRYPTION_KEY=[32-char-encryption-key]
```

### 3. Local Development

```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## 📦 Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Vercel

```bash
npm i -g vercel
vercel
```

### 3. Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_BASE_URL`
- `ENCRYPTION_KEY`

### 4. Inngest Setup

1. Go to [inngest.com](https://inngest.com)
2. Create app with Vercel integration
3. Connect GitHub repo
4. Inngest deploys automatically with `pages/api/inngest.ts`

---

## 🔌 API Endpoints

### POST `/api/validate`
Validate and check a Discord token

**Request:**
```json
{
  "token": "email:password:MTk4NjIyNDcwMjU1MjcyMzI0.Clwa7A.123..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "tokenHash": "sha256-hash",
    "status": "pending"
  },
  "statusCode": 202
}
```

### GET `/api/status`
Check job status and progress

**Query Parameters:**
- `jobId` (required) - Job ID from validate response

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "SUCCESS|FAILED|PENDING",
    "operation": "CHECK|COMPLETE_QUEST",
    "progress": 0-100,
    "result": {...},
    "updatedAt": 1234567890
  }
}
```

### POST `/api/execute`
Execute operation on validated token

**Request:**
```json
{
  "tokenHash": "sha256-hash",
  "operation": "COMPLETE_QUEST|CLAIM_QUEST|CHECK|CHECK_NITRO",
  "questId": "optional-quest-id",
  "token": "actual-token",
  "email": "email@example.com"
}
```

---

## 🔄 Security Gate Flow

```
User Input
    ↓
FORMAT VALIDATION (email:password:token structure)
    ↓
STRUCTURE VALIDATION (length, patterns, email, password)
    ↓
CONTENT VALIDATION (Discord token structure)
    ↓
RATE LIMIT CHECK (50 ops/minute)
    ↓
CACHE CHECK (1-hour result cache)
    ↓
ACCOUNT VALIDITY CHECK (401/403/flags)
    ↓
OPERATION PRE-CHECK (email verified, not locked, not flagged)
    ↓
OPERATION LOCK (prevent duplicates)
    ↓
EXECUTE
```

---

## 📊 Database Schema (Vercel KV)

### Sessions
```
session:{tokenHash} → {
  tokenHash: string,
  email: string (encrypted),
  checkResult: AccountCheckResult,
  createdAt: number,
  expiresAt: number
}
```

### Jobs
```
job:{jobId} → {
  jobId: string,
  status: JobStatus,
  operation: OperationType,
  progress: 0-100,
  result: any,
  error: string,
  updatedAt: number
}
```

### Rate Limits
```
ratelimit:{tokenHash} → incrementing counter (60s TTL)
```

### Locks
```
lock:{tokenHash}:{operation} → "locked" (300s TTL)
```

---

## 🧪 Testing

### Unit Tests (TypeScript)

```bash
npm run type-check
```

### Local Testing

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Paste tokens: `email:password:token`
4. Click "Validate Tokens"
5. Select token and execute operation

---

## 🐛 Troubleshooting

### "Token not found" error
- Token might have expired (24-hour session TTL)
- Validate token again

### "Rate limited" error
- Wait 60 seconds before next operation
- Each token has 50 ops/minute limit

### "Account locked" error
- Discord API returned 403
- Account is suspended/locked by Discord

### "Quest not found" error
- Quest ID is invalid
- Check quest ID format

### Inngest jobs not running
- Verify `INNGEST_EVENT_KEY` is correct
- Check Inngest dashboard for errors
- Ensure `pages/api/inngest.ts` is deployed

---

## 📈 Monitoring

### Inngest Dashboard
- Monitor job status: [inngest.com/dashboard](https://inngest.com/dashboard)
- View retries and errors
- Check execution logs

### Vercel Analytics
- Monitor response times
- Track error rates
- View Cold Start metrics

### Vercel KV Console
- Debug session data
- Monitor cache hit rates
- Track rate limit counters

---

## 🔒 Security Best Practices

✅ **Do:**
- Use HTTPS only in production
- Enable Vercel security headers (done)
- Rotate `ENCRYPTION_KEY` regularly
- Monitor logs for suspicious activity
- Use strong environment variables

❌ **Don't:**
- Log full tokens (we don't)
- Store tokens in plaintext (encrypted)
- Skip rate limiting
- Skip pre-execution validation
- Expose error messages to users

---

## 📝 Code Quality

- **TypeScript** - Full type safety, no `any`
- **ESLint** - Code linting (configured in `.eslintrc`)
- **Prettier** - Code formatting

```bash
npm run type-check
npm run format
npm run lint
```

---

## 🚀 Performance Optimizations

- **Connection Pooling** - TLS-client reuse
- **Exponential Backoff** - Smart retry strategy
- **Caching** - 1-hour account check cache
- **Job Queue** - Async processing, no blocking
- **Rate Limiting** - Pre-request validation
- **Compression** - Gzip response compression

---

## 📄 License

MIT License. See `LICENSE` file for details.

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m "Add amazing feature"`
4. Push to branch: `git push origin feature/amazing`
5. Open Pull Request

---

## 💬 Support

- Issues: [GitHub Issues](https://github.com/...)
- Email: support@example.com
- Discord: [Join Server](https://discord.gg/...)

---

## 🙏 Acknowledgments

- [Vercel](https://vercel.com) - Hosting
- [Inngest](https://inngest.com) - Job queue
- [Upstash](https://upstash.com) - Redis/KV
- [tls_client](https://github.com/FlorianREGAZ/Python-Requests-TLS) - TLS fingerprinting

---

**Built with 🔥 by @hermeshu**
