# Deployment Guide

Complete step-by-step guide to deploy Discord Multi-Tool to Vercel.

---

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] GitHub account with repo access
- [ ] Vercel account (free tier ok)
- [ ] Inngest account (free tier ok)
- [ ] Upstash account for Redis/KV

---

## Step 1: Prepare Upstash Redis

### Create Redis Instance

1. Go to [upstash.com](https://upstash.com)
2. Sign up / Log in
3. Create new Redis database:
   - **Database Name:** `discord-multi-tool`
   - **Region:** Choose closest to you
   - **Type:** Pay as you go

### Get Credentials

1. Click on database name
2. Copy `UPSTASH_REDIS_REST_URL` → `KV_REST_API_URL`
3. Copy `UPSTASH_REDIS_REST_TOKEN` → `KV_REST_API_TOKEN`
4. For `KV_URL`, use the REST URL but with protocol changed from `https` to `redis`

**Example:**
```
KV_REST_API_URL=https://bold-grub-12345.upstash.io
KV_REST_API_TOKEN=AaYpCaD...
KV_URL=redis://bold-grub-12345.upstash.io:6379
```

---

## Step 2: Setup Inngest

### Create Inngest App

1. Go to [inngest.com](https://inngest.com)
2. Sign up with GitHub
3. Create new app: `discord-multi-tool`
4. Choose **Vercel** integration
5. Connect GitHub repo

### Get Event Key

1. Go to App Settings
2. Copy **Event Key** → `INNGEST_EVENT_KEY`
3. Format: `evt_prod_xxxxx`

---

## Step 3: Generate Encryption Key

```bash
# Generate 32-character encryption key
openssl rand -base64 32
```

Copy output → `ENCRYPTION_KEY` environment variable

---

## Step 4: Push to GitHub

```bash
# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Discord Multi-Tool"

# Add remote (replace with your repo)
git remote add origin https://github.com/YOUR_USERNAME/discord-multi-tool.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## Step 5: Deploy to Vercel

### Option A: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

### Option B: Via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import GitHub repository
4. Select `discord-multi-tool`
5. Click "Import"

---

## Step 6: Add Environment Variables

### In Vercel Dashboard

1. Go to Project Settings → **Environment Variables**
2. Add each variable:

```
KV_URL = redis://bold-grub-12345.upstash.io:6379
KV_REST_API_URL = https://bold-grub-12345.upstash.io
KV_REST_API_TOKEN = AaYpCaD...
INNGEST_EVENT_KEY = evt_prod_xxxxx
INNGEST_BASE_URL = https://inngest.com
ENCRYPTION_KEY = [generated 32-char key]
NEXT_PUBLIC_API_BASE = https://your-vercel-domain.vercel.app
```

3. Click "Save"
4. Redeploy: Project → Deployments → ... → Redeploy

---

## Step 7: Test Deployment

### Check Vercel Deployment

1. Wait for deployment to complete
2. Click "Visit" to open your app
3. Should see dark dashboard interface

### Test Validation

1. Paste test token: `test@example.com:password:INVALIDTOKEN123456789`
2. Click "Validate Tokens"
3. Should show validation error (invalid token format is ok for test)

### Check Inngest

1. Go to [inngest.com/dashboard](https://inngest.com/dashboard)
2. Select your app
3. Should see "Syncing..." then job definitions appear
4. Handlers: `check-token`, `complete-quest`, `claim-quest`, `check-nitro`

---

## Step 8: Verify All Services

### Verify Vercel

```bash
curl https://your-domain.vercel.app
```

Should return HTML (dashboard)

### Verify KV Connectivity

In Vercel Logs, should see no KV errors.

### Verify Inngest

In Inngest Dashboard:
- App should show "Connected"
- Handlers should show "Synced"

---

## Step 9: Monitor & Logs

### View Vercel Logs

```bash
vercel logs discord-multi-tool
```

### View Inngest Logs

1. Inngest Dashboard → Your App → Logs
2. Run test operation to see logs

### View KV Data

1. Upstash Dashboard → Your Database
2. Click "CLI" to browse data
3. Keys: `session:*`, `job:*`, `ratelimit:*`, etc.

---

## Troubleshooting

### "KV connection error"

1. Check `KV_REST_API_URL` and `KV_REST_API_TOKEN` in Vercel env
2. Verify Redis instance is running in Upstash
3. Test with:
```bash
curl -X GET "https://YOUR_KV_URL/get/test" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### "Inngest event key invalid"

1. Check `INNGEST_EVENT_KEY` format: `evt_prod_xxxxx`
2. Verify key is from your app, not another
3. Check Inngest integration is connected to GitHub

### "Jobs not running"

1. Check Inngest Logs for errors
2. Verify `pages/api/inngest.ts` exists
3. Check Vercel deployment includes all files
4. Redeploy from Vercel dashboard

### "Tokens getting rejected"

1. Check account isn't locked/flagged
2. Verify token format: `email:password:token`
3. Check rate limits: max 50 ops/minute per token
4. View logs: `vercel logs discord-multi-tool`

### "CORS errors in browser"

1. Check Vercel CORS headers in `next.config.js`
2. Verify API routes return `Access-Control-Allow-*` headers
3. Check browser console for exact CORS error

---

## Production Checklist

- [ ] All env vars set in Vercel
- [ ] Redis instance created and verified
- [ ] Inngest app synced and handlers shown
- [ ] Test token validation works
- [ ] Test job execution completes
- [ ] Logs show no errors
- [ ] Monitor Inngest for failed jobs
- [ ] Enable Vercel error tracking
- [ ] Setup Sentry (optional) for error monitoring
- [ ] Enable rate limiting (already built-in)

---

## Scaling Tips

### Rate Limiting
- Current: 50 ops/minute per token
- Adjust in `lib/db.ts` → `checkRateLimit()`

### Job Retries
- Current: 3-4 retries with exponential backoff
- Adjust in `lib/inngest.ts` → `retryPolicy`

### Cache Duration
- Current: 1 hour for account checks
- Adjust in `lib/db.ts` → `cacheAccountCheck()`

### Concurrent Jobs
- Vercel handles 1000 concurrent requests
- Inngest queues additional load
- No manual scaling needed

---

## Maintenance

### Regular Tasks

- [ ] Monitor Vercel logs weekly
- [ ] Check Inngest dashboard for failed jobs
- [ ] Review Upstash Redis memory usage
- [ ] Backup important data if needed

### Updates

```bash
# Pull latest
git pull origin main

# Install new deps
npm install

# Redeploy
vercel
```

---

## Support

- **Vercel:** [vercel.com/support](https://vercel.com/support)
- **Inngest:** [discord.gg/inngest](https://discord.gg/inngest)
- **Upstash:** [upstash.com/support](https://upstash.com/support)

---

**Deployed successfully? Celebrate! 🎉**
