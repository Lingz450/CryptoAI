# 🚀 GhostFX Setup Guide

Complete step-by-step guide to get GhostFX running locally.

---

## Prerequisites

Before starting, ensure you have:

- ✅ **Node.js 18+** ([Download](https://nodejs.org/))
- ✅ **PostgreSQL** ([Download](https://www.postgresql.org/download/) or use Docker)
- ✅ **Redis** ([Download](https://redis.io/download) or use Docker)
- ✅ **Git** ([Download](https://git-scm.com/))

---

## Quick Start (5 minutes)

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd ghostfx
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start PostgreSQL & Redis (Docker)

If you have Docker installed:

```bash
docker-compose up -d postgres redis
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

**Or install them manually:**
- [PostgreSQL Installation](https://www.postgresql.org/download/)
- [Redis Installation](https://redis.io/download)

### 4. Create Environment File

Copy the example and edit:

```bash
cp .env.local.example .env
```

**Edit `.env` with your values:**

```bash
# Minimum required for local development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ghostfx"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

### 5. Setup Database

```bash
npx prisma db push
npx prisma generate
```

### 6. Start Development Server

**Terminal 1: Next.js App**
```bash
npm run dev
```

**Terminal 2: Background Workers**
```bash
npm run worker
```

### 7. Open App

Visit **http://localhost:3000** 🎉

---

## Detailed Setup

### Environment Variables Explained

#### Required (Minimum)

```bash
# PostgreSQL connection
DATABASE_URL="postgresql://user:password@host:port/database"

# Redis connection  
REDIS_URL="redis://localhost:6379"

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-random-secret-key"

# Your app URL
NEXTAUTH_URL="http://localhost:3000"
```

#### Optional (Enhanced Features)

```bash
# Email authentication
EMAIL_SERVER="smtp://user:password@smtp.gmail.com:587"
EMAIL_FROM="noreply@yourdomain.com"

# Telegram bot integration
TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
TELEGRAM_BOT_USERNAME="YourBotName"

# OpenAI for AI narratives
OPENAI_API_KEY="sk-proj-..."

# Exchange API keys (for higher rate limits)
BINANCE_API_KEY="your-api-key"
BINANCE_SECRET_KEY="your-secret-key"

# App configuration
DEFAULT_EXCHANGE="binance"
UNIVERSE_LIMIT="100"
ALERT_CHECK_INTERVAL="60000"
MARKET_PULSE_INTERVAL="180000"
```

---

## Database Setup

### Option 1: Docker (Easiest)

```bash
# Start PostgreSQL
docker-compose up -d postgres

# The connection string is:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ghostfx"
```

### Option 2: Local PostgreSQL

```bash
# macOS (with Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb ghostfx

# Connection string
DATABASE_URL="postgresql://your-username@localhost:5432/ghostfx"
```

### Option 3: Cloud Database

Use [Neon](https://neon.tech/), [Supabase](https://supabase.com/), or [Railway](https://railway.app/):

```bash
# Example Neon connection
DATABASE_URL="postgresql://user:pass@ep-xyz.us-east-1.aws.neon.tech/ghostfx"
```

### Initialize Database

```bash
# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

---

## Redis Setup

### Option 1: Docker (Easiest)

```bash
docker-compose up -d redis

# Connection string
REDIS_URL="redis://localhost:6379"
```

### Option 2: Local Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Connection string
REDIS_URL="redis://localhost:6379"
```

### Option 3: Cloud Redis

Use [Upstash](https://upstash.com/) or [Redis Cloud](https://redis.com/cloud/):

```bash
# Example Upstash
REDIS_URL="rediss://default:password@region.upstash.io:6379"
```

---

## Email Setup (Optional)

### Gmail

1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use in `.env`:

```bash
EMAIL_SERVER="smtp://your-email@gmail.com:app-password@smtp.gmail.com:587"
EMAIL_FROM="GhostFX <noreply@yourdomain.com>"
```

### SendGrid

```bash
EMAIL_SERVER="smtp://apikey:YOUR_SENDGRID_API_KEY@smtp.sendgrid.net:587"
EMAIL_FROM="GhostFX <noreply@yourdomain.com>"
```

---

## Telegram Bot Setup (Optional)

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow instructions
3. Copy the token
4. Add to `.env`:

```bash
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_BOT_USERNAME="YourBotName"
```

---

## Exchange API Keys (Optional)

### Why Add Keys?

Public endpoints work without API keys, but have **rate limits**. Adding keys gives you:
- Higher rate limits
- Faster data access
- More reliable service

### Binance

1. Login to [Binance](https://www.binance.com/)
2. Profile → API Management
3. Create API Key (read-only permissions)
4. Add to `.env`:

```bash
BINANCE_API_KEY="your-key"
BINANCE_SECRET_KEY="your-secret"
```

### Bybit

1. Login to [Bybit](https://www.bybit.com/)
2. Account → API Management
3. Create API Key (read-only)
4. Add to `.env`:

```bash
BYBIT_API_KEY="your-key"
BYBIT_SECRET_KEY="your-secret"
```

### OKX

1. Login to [OKX](https://www.okx.com/)
2. Profile → API
3. Create API Key (read-only + trade permissions off)
4. Add to `.env`:

```bash
OKX_API_KEY="your-key"
OKX_SECRET_KEY="your-secret"
OKX_PASSPHRASE="your-passphrase"
```

---

## Running the Application

### Development Mode

**Terminal 1: Next.js**
```bash
npm run dev
```
Runs on http://localhost:3000

**Terminal 2: Workers**
```bash
npm run worker
```
Runs background jobs (alerts, market pulse, etc.)

### Production Build

```bash
# Build the app
npm run build

# Start production server
npm run start

# Start workers in production
NODE_ENV=production npm run worker
```

---

## Common Issues & Solutions

### Issue: "Can't connect to PostgreSQL"

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready

# Check connection string format
DATABASE_URL="postgresql://user:password@host:port/database"

# Test connection
psql $DATABASE_URL
```

### Issue: "Redis connection failed"

**Solution:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running:
redis-server

# Or with Docker:
docker-compose up -d redis
```

### Issue: "Prisma Client not generated"

**Solution:**
```bash
npx prisma generate
```

### Issue: "Workers won't start"

**Solution:**
```bash
# Ensure Redis is running
redis-cli ping

# Check REDIS_URL in .env
echo $REDIS_URL

# Clear Redis cache
redis-cli FLUSHALL
```

### Issue: "Exchange API errors"

**Solution:**
- Verify exchange APIs are accessible (check your firewall/VPN)
- Public endpoints work without API keys
- If using API keys, verify they're correct
- Check rate limits (wait a few minutes)

---

## Verification Checklist

After setup, verify everything works:

- [ ] ✅ Visit http://localhost:3000 - homepage loads
- [ ] ✅ Click on BTC - coin analysis loads
- [ ] ✅ Market pulse ticker shows live prices
- [ ] ✅ Top gainers/losers display
- [ ] ✅ Workers running without errors
- [ ] ✅ Database connection working (check Prisma Studio)
- [ ] ✅ Redis connection working (check worker logs)

---

## Next Steps

Once running:

1. **Create an account** (if authentication is set up)
2. **Explore coin analyses** - visit `/coin/BTC`, `/coin/ETH`, etc.
3. **Test screeners** - check ATR breakouts, EMA crosses
4. **Set up alerts** (requires authentication)
5. **Add to watchlist** (requires authentication)

---

## Development Tips

### Hot Reload

Next.js automatically reloads when you edit files in:
- `src/app/` - pages
- `src/components/` - components
- `src/lib/` - utilities

Workers need manual restart:
```bash
# Stop with Ctrl+C
# Restart
npm run worker
```

### Database Changes

After editing `prisma/schema.prisma`:

```bash
# Apply changes
npx prisma db push

# Regenerate client
npx prisma generate
```

### View Database

```bash
npx prisma studio
```

Opens GUI at http://localhost:5555

### Clear Cache

```bash
# Redis cache
redis-cli FLUSHALL

# Next.js cache
rm -rf .next
```

---

## Production Deployment

See [Deployment Guide](./docs/DEPLOYMENT.md) for:
- Vercel deployment
- Docker deployment
- VPS deployment with PM2
- Environment variable setup
- Worker deployment

---

## Need Help?

- 📖 **Documentation**: Check README.md
- 🐛 **Bug Report**: Open GitHub issue
- 💬 **Questions**: Discussions tab
- 📧 **Email**: support@ghostfx.io

---

**You're all set! Happy trading! 🚀**

