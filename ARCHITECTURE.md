# Architecture Documentation

Complete technical architecture of Discord Multi-Tool serverless platform.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
│  React Dashboard (TypeScript) - Single Page Application     │
│  - Token input & validation                                 │
│  - Real-time status updates                                 │
│  - Operation queue display                                  │
│  - Results export                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│              VERCEL EDGE RUNTIME (Next.js)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        API Routes (TypeScript)                      │   │
│  │  - POST /api/validate (Token validation)           │   │
│  │  - GET /api/status (Job status)                    │   │
│  │  - POST /api/execute (Operation execution)         │   │
│  │  - POST /api/inngest (Inngest handler)             │   │
│  └──────────────────┬────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼────────────────────────────────┐   │
│  │   Validation Layer (lib/validation.ts)            │   │
│  │   - Format gate (: separators)                    │   │
│  │   - Structure gate (lengths, patterns)            │   │
│  │   - Content gate (Discord token format)           │   │
│  └──────────────────┬────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼────────────────────────────────┐   │
│  │   Security Gates (API routes)                     │   │
│  │   - Rate limit check                              │   │
│  │   - Cache lookup                                  │   │
│  │   - Account validity check                        │   │
│  │   - Operation pre-check                           │   │
│  │   - Duplicate prevention                          │   │
│  └──────────────────┬────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼────────────────────────────────┐   │
│  │   Discord Service (lib/discord-service.ts)        │   │
│  │   - TLS-client session management                 │   │
│  │   - API endpoint calls                            │   │
│  │   - Automatic retry with backoff                  │   │
│  │   - Error handling                                │   │
│  └──────────────────┬────────────────────────────────┘   │
└──────────────────────┼──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────────┐ ┌─▼────────────┐
│  INNGEST     │ │ VERCEL KV    │ │ DISCORD API  │
│ Job Queue    │ │ (Redis)      │ │              │
│              │ │              │ │ /api/users   │
│ - check-     │ │ - Sessions   │ │ /api/quests  │
│   token      │ │ - Jobs       │ │ /api/billing │
│ - complete-  │ │ - Rate limits│ │              │
│   quest      │ │ - Locks      │ │              │
│ - claim-     │ │ - Cache      │ │              │
│   quest      │ │              │ │              │
│ - check-nitro│ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Data Flow

### 1. Token Validation Flow

```
User Input (email:password:token)
    ↓
FORMAT GATE
├─ Check for `:` separators
├─ Check parts exist
└─ Check 3 parts total
    ↓ [PASS]
STRUCTURE GATE
├─ Email validation
├─ Password min length
├─ Token length (68-72 chars)
└─ Token regex pattern
    ↓ [PASS]
CONTENT GATE
├─ Discord token structure (3 parts with dots)
├─ User ID segment validation
├─ Timestamp segment validation
└─ Signature segment validation
    ↓ [PASS]
RATE LIMIT CHECK
├─ Check Redis counter
└─ Increment counter (60s TTL)
    ↓ [PASS]
CACHE CHECK
├─ Lookup session:{hash}
└─ Return cached result if exists
    ↓ [MISS]
QUEUE JOB
├─ Create job record
├─ Send to Inngest
└─ Return jobId to user
    ↓
JOB EXECUTES (Inngest)
├─ Fetch Discord user
├─ Check subscriptions
├─ Check boosts
└─ Calculate account age
    ↓ [SUCCESS]
STORE SESSION
├─ Encrypt email
├─ Store in Redis
└─ Set 24h TTL
    ↓
UPDATE JOB
├─ Set status: SUCCESS
├─ Store check result
└─ Update job record
```

### 2. Quest Operation Flow

```
User Selects Operation
    ↓
SESSION LOOKUP
├─ Verify token validated
└─ Get cached check result
    ↓ [VALID]
PRE-EXECUTION GATES
├─ Check account not locked
├─ Check account not flagged
├─ Check email verified (quests only)
└─ Check rate limit
    ↓ [PASS]
ACQUIRE LOCK
├─ Check lock:{tokenHash}:{operation}
└─ Set lock if available
    ↓ [SUCCESS]
QUEUE JOB
├─ Create job record
├─ Send to Inngest
└─ Return jobId
    ↓
JOB EXECUTES
├─ STEP 1: Enroll quest
│  ├─ POST /quests/{id}/enroll
│  └─ Check 200 status
├─ STEP 2: Complete quest
│  ├─ POST /quests/{id}/video-progress
│  ├─ Loop until completed_at
│  └─ PATCH /users/@me/agreements
└─ STEP 3: Finalize
   ├─ Update job: SUCCESS
   └─ Record statistics
    ↓ [ERROR]
HANDLE ERROR
├─ Check if recoverable
├─ Retry if needed (max 2x)
├─ Update job: FAILED
└─ Release lock
```

---

## Component Architecture

### Frontend Layer

**File:** `components/DiscordDashboard.tsx`

```typescript
DiscordDashboard
├─ State Management
│  ├─ tokenInput: string
│  ├─ tokens: TokenResult[]
│  ├─ processing: ProcessingJob[]
│  └─ selectedToken: TokenResult | null
├─ Token Processing
│  ├─ handlePaste(): Parse & validate
│  ├─ validateToken(): Call API
│  └─ Poll job status
├─ Operations
│  ├─ executeOperation(): Queue job
│  └─ Poll job status
└─ Rendering
   ├─ Token list
   ├─ Operation buttons
   ├─ Job queue display
   └─ Real-time status updates
```

### Validation Layer

**File:** `lib/validation.ts`

```typescript
Validation Pipeline
├─ validateFormat()
│  └─ Check `:` separators, part count
├─ validateStructure()
│  ├─ Email validation (regex)
│  ├─ Password length check
│  └─ Token pattern validation
├─ validateContent()
│  ├─ Token structure (3 dot-separated parts)
│  └─ Segment length validation
└─ parseToken()
   ├─ Extract email, password, token
   └─ Generate SHA-256 hash
```

### Discord Service Layer

**File:** `lib/discord-service.ts`

```typescript
DiscordService
├─ Session Management
│  └─ createSession(token): TLSSession
├─ User Operations
│  ├─ getUser(token): DiscordUser
│  ├─ getSubscriptions(token): Subscription[]
│  └─ getBoostSlots(token): number
├─ Quest Operations
│  ├─ enrollQuest(token, questId): boolean
│  └─ completeQuest(token, questId): boolean
└─ Resilience
   ├─ makeRequest(): with backoff
   ├─ Exponential backoff (1s → 30s)
   └─ Max 4 retries per request
```

### Database Layer

**File:** `lib/db.ts`

```typescript
DatabaseService (Vercel KV)
├─ Token Sessions
│  ├─ storeTokenSession(): Encrypt & store
│  └─ getTokenSession(): Decrypt & return
├─ Job Management
│  ├─ createJob(): Initialize
│  ├─ updateJobStatus(): Track progress
│  └─ getJobStatus(): Retrieve status
├─ Rate Limiting
│  └─ checkRateLimit(): 50 ops/min
├─ Caching
│  ├─ cacheAccountCheck(): 1 hour
│  └─ getAccountCheckCache(): Retrieve
└─ Locks
   ├─ acquireLock(): Prevent duplicates
   └─ releaseLock(): Release lock
```

### Job Queue

**File:** `lib/inngest.ts`

```typescript
Inngest Functions
├─ checkTokenHandler
│  ├─ Get user info
│  ├─ Check subscriptions
│  ├─ Get boost slots
│  └─ Store session
├─ completeQuestHandler
│  ├─ Acquire lock
│  ├─ Enroll quest
│  ├─ Complete quest
│  ├─ Accept agreements
│  └─ Release lock
├─ claimQuestHandler
│  └─ Similar to complete
└─ checkNitroHandler
   ├─ Get subscriptions
   └─ Get boost slots
```

---

## Security Architecture

### Encryption

```
ENCRYPTION_KEY (AES-256)
└─ Generate: openssl rand -base64 32
└─ Storage: Vercel env vars (encrypted)

Encrypt Flow:
┌──────────────┐
│ Plaintext    │
│ (email)      │
└─────┬────────┘
      │
      ▼
┌──────────────────────┐
│ 1. Generate IV (16B) │
│ 2. Create cipher     │
│ 3. Encrypt data      │
│ 4. Finalize cipher   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────┐
│ IV:Ciphertext    │
│ (stored in KV)   │
└──────────────────┘

Decrypt Flow:
┌──────────────────┐
│ IV:Ciphertext    │
│ (from KV)        │
└─────┬────────────┘
      │
      ▼
┌──────────────────────┐
│ 1. Split IV & cipher │
│ 2. Create decipher   │
│ 3. Decrypt data      │
│ 4. Finalize decipher │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Plaintext            │
│ (email)              │
└──────────────────────┘
```

### Token Handling

```
NO PLAINTEXT STORAGE

Token Lifecycle:
┌─────────────────┐
│ User submits    │
│ email:pw:token  │
└────────┬────────┘
         │
         ▼ (Validation)
┌─────────────────────────┐
│ Token validated         │
│ Hash: SHA-256(token)    │
│ Hash stored in sessions │
│ Token sent to Discord   │
│ Token NEVER logged      │
└────────┬────────────────┘
         │
         ▼ (Completion)
┌──────────────────────┐
│ Job complete         │
│ Token discarded      │
│ Only hash remains    │
└──────────────────────┘
```

### Rate Limiting

```
Redis Counter Pattern
├─ Key: ratelimit:{tokenHash}
├─ Value: counter
├─ TTL: 60 seconds
└─ Increment on each request

Logic:
1. INCR ratelimit:{tokenHash}
2. If result = 1, EXPIRE 60
3. If result > 50, reject with 429

Benefits:
- Atomic operations
- Automatic cleanup (TTL)
- Per-token limits
- Prevents abuse
```

### Operation Locking

```
Redis Lock Pattern
├─ Key: lock:{tokenHash}:{operation}
├─ Value: "locked"
├─ TTL: 300 seconds (5 minutes)
└─ Set only if not exists

Logic:
1. Check if lock exists
2. If yes, reject (operation in progress)
3. If no, set lock with TTL
4. Execute operation
5. Release lock on completion/error

Benefits:
- Prevents duplicate operations
- Automatic cleanup (TTL)
- Thread-safe via Redis atomicity
```

---

## Error Handling Strategy

### Error Classification

```
VALIDATION ERRORS (400)
├─ Invalid format
├─ Invalid structure
└─ Invalid content

AUTHENTICATION ERRORS (401)
├─ Invalid token
└─ Token expired

AUTHORIZATION ERRORS (403)
├─ Account locked
├─ Account flagged
└─ Email not verified

RATE LIMIT ERRORS (429)
├─ Too many requests
└─ Token limit exceeded

SERVER ERRORS (500)
├─ Database error
├─ Queue error
└─ Discord API error

RECOVERABLE vs NON-RECOVERABLE
├─ Recoverable: 429, 5xx (retry)
└─ Non-recoverable: 401, 403, 400
```

### Retry Strategy

```
Exponential Backoff
├─ Initial delay: 1000ms
├─ Multiplier: 1.5x
├─ Max delay: 30000ms
├─ Max retries: 4
└─ Jitter: +0-100ms (prevent thundering herd)

Example:
Attempt 1: fail → wait 1000ms
Attempt 2: fail → wait 1500ms
Attempt 3: fail → wait 2250ms
Attempt 4: fail → wait 3375ms
Attempt 5: fail → throw error
```

---

## Performance Characteristics

### Latency Targets

```
Token Validation: < 2s
├─ Format check: 1ms
├─ Structure check: 1ms
├─ Content check: 1ms
├─ Rate limit check: 10ms
├─ Cache lookup: 20ms
├─ Discord API call: 500ms (varies)
└─ Job queue: 50ms

Quest Operation: < 10s
├─ Lock acquisition: 10ms
├─ Enroll request: 500ms
├─ Progress loop: 5000ms (varies)
├─ Agreement patch: 500ms
└─ Job update: 20ms
```

### Throughput Targets

```
Concurrent Tokens: 1000+
├─ Vercel concurrent requests: 1000
├─ KV concurrent: 1000
└─ Inngest concurrent: 1000

Tokens Per Minute: 3000
├─ With 50 req/min per token
├─ Supports 60 concurrent tokens
└─ Can handle spikes via queue
```

### Resource Usage

```
Memory (per request): ~10MB
├─ Node runtime: 5MB
├─ Session data: 1MB
├─ Job data: 1MB
└─ Working memory: 3MB

Storage (per token): ~1KB
├─ Session data (encrypted): 500B
├─ Job result: 500B

Network (per operation): ~10KB
├─ Request headers: 2KB
├─ Response body: 5KB
└─ Discord API overhead: 3KB
```

---

## Monitoring & Observability

### Metrics to Track

```
Success Metrics
├─ Validation success rate
├─ Quest completion rate
├─ Average operation time
└─ Cache hit rate

Error Metrics
├─ Token invalid rate
├─ Account locked rate
├─ Rate limit hits
└─ Server error rate

Performance Metrics
├─ P50 latency
├─ P99 latency
├─ Concurrent operations
└─ Queue depth
```

### Logging Strategy

```
Log Levels
├─ DEBUG: Detailed flow (disabled in prod)
├─ INFO: Operation start/completion
├─ WARN: Rate limits, missing cache
└─ ERROR: Exceptions, failures

Token Masking
├─ Full token: Never logged
├─ Token hash: First 16 chars only
├─ Email: First 2 chars + domain
└─ Job ID: Full UUID for tracking
```

---

## Deployment Topology

```
┌──────────────────────────────────────┐
│     GitHub (Source Code)             │
│     - Webhooks on push               │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│     Vercel (Deployment)              │
│     - Auto build on push             │
│     - Global CDN                     │
│     - Serverless functions           │
│     - Environment variables          │
└────────┬───────────┬────────┬────────┘
         │           │        │
         ▼           ▼        ▼
    ┌────────┐  ┌────────┐  ┌─────────┐
    │Inngest │  │Vercel  │  │Upstash  │
    │        │  │KV      │  │Redis    │
    │Job Q   │  │State   │  │Cache    │
    └────────┘  └────────┘  └─────────┘
         │           │        │
         └─────┬─────┴────────┘
               │
               ▼
        ┌──────────────┐
        │ Discord API  │
        └──────────────┘
```

---

## Future Optimization Opportunities

1. **WebSocket**: Real-time job updates vs polling
2. **Caching Layer**: CDN for static assets
3. **Batch Operations**: Process tokens in batches
4. **Analytics**: Segment.io or similar
5. **Authentication**: API keys for service-to-service
6. **Rate Limit Optimization**: Token-bucket algorithm
7. **Database Sharding**: Multiple KV instances
8. **Distributed Tracing**: OpenTelemetry integration

---

**Architecture by @hermeshu | Optimized for Production** 🔥
