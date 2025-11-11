# 🔧 GhostFX Troubleshooting Guide

## Common Issues and Solutions

### 1. "hashQueryKey is not exported" Error

**Error Message:**
```
Attempted import error: 'hashQueryKey' is not exported from '@tanstack/react-query'
```

**Cause:**
Version incompatibility between `@tanstack/react-query` v5 and `@trpc/react-query` v10.

**Solution:**
Use TanStack Query v4 which is fully compatible with tRPC v10:

```bash
# Remove old dependencies
rm -rf node_modules package-lock.json

# Install with correct versions
npm install --legacy-peer-deps
```

**Fixed versions in package.json:**
```json
{
  "@tanstack/react-query": "^4.36.1",
  "@trpc/client": "^10.45.0",
  "@trpc/next": "^10.45.0",
  "@trpc/react-query": "^10.45.0",
  "@trpc/server": "^10.45.0"
}
```

---

### 2. Database Connection Errors

**Error:** `Can't reach database server`

**Solutions:**
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Or check if PostgreSQL is running
# Windows:
net start postgresql-x64-15

# Verify connection
psql $env:DATABASE_URL
```

---

### 3. Redis Connection Errors

**Error:** `Connection refused on port 6379`

**Solutions:**
```bash
# Start Redis with Docker
docker-compose up -d redis

# Or start Redis locally
# Windows (with WSL):
sudo service redis-server start

# Verify connection
redis-cli ping
# Should return: PONG
```

---

### 4. Prisma Client Not Generated

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npx prisma generate
```

---

### 4b. Missing NextAuth Prisma Adapter

**Error:** `Module not found: Can't resolve '@next-auth/prisma-adapter'`

**Solution:**
The package should be in dependencies. If missing:
```bash
npm install @next-auth/prisma-adapter --legacy-peer-deps
```

Fixed in `package.json`:
```json
{
  "@next-auth/prisma-adapter": "^1.0.7"
}
```

---

### 5. Build Errors After Dependency Updates

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules
rm -rf node_modules package-lock.json

# Reinstall
npm install --legacy-peer-deps

# Regenerate Prisma client
npx prisma generate
```

---

### 6. TypeScript Errors

**Error:** Type conflicts or missing declarations

**Solution:**
```bash
# Ensure correct TypeScript version
npm install -D typescript@5.3.3

# Clear TypeScript cache
rm -rf .next tsconfig.tsbuildinfo

# Restart TypeScript server in VS Code
# Press Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

---

### 7. Exchange API Rate Limits

**Error:** `429 Too Many Requests`

**Solutions:**
- Add API keys to `.env` (increases rate limits)
- Reduce `MARKET_PULSE_INTERVAL` and `ALERT_CHECK_INTERVAL`
- Use caching (Redis required)

---

### 8. Workers Won't Start

**Error:** Worker crashes or won't connect

**Checklist:**
```bash
# 1. Verify Redis is running
redis-cli ping

# 2. Check REDIS_URL in .env
echo $env:REDIS_URL

# 3. Clear Redis queues
redis-cli FLUSHALL

# 4. Restart workers
npm run worker
```

---

### 9. Authentication Issues

**Error:** `useSession must be wrapped in a <SessionProvider />`

**Solution:**
Ensure your app is wrapped with `SessionProvider`. This is already configured in `src/components/Providers.tsx`.

**Error:** NextAuth callback errors or authentication not working

**Solutions:**
```bash
# 1. Verify NEXTAUTH_SECRET is set
echo $env:NEXTAUTH_SECRET

# 2. Generate new secret if needed
openssl rand -base64 32

# 3. Update .env with new secret
NEXTAUTH_SECRET="your-new-secret"

# 4. Set up database (required for authentication)
npx prisma db push

# 5. Configure email provider in .env
EMAIL_SERVER="smtp://user:password@smtp.gmail.com:587"
EMAIL_FROM="noreply@yourdomain.com"
```

**Note:** Authentication features require database setup. Without it, you can still:
- View homepage with live prices
- Analyze any coin (e.g., `/coin/BTC`)
- View top movers and market data

---

### 10. Port Already in Use

**Error:** `Port 3000 is already in use`

**Solutions:**
```bash
# Windows - Find and kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
# In package.json:
"dev": "next dev -p 3001"
```

---

## Quick Reset Commands

### Full Reset (when nothing works)
```bash
# Stop all processes
# Press Ctrl+C in all terminals

# Clean everything
rm -rf node_modules package-lock.json .next

# Reinstall
npm install --legacy-peer-deps
npx prisma generate

# Start fresh
npm run dev
```

---

## Debugging Tips

### Check Logs

**Next.js:**
```bash
npm run dev
# Watch console output
```

**Workers:**
```bash
npm run worker
# Check for Redis connection
# Check for Prisma client errors
```

**Database:**
```bash
npx prisma studio
# Opens GUI at http://localhost:5555
```

---

### Environment Variables

**Verify all required variables are set:**
```bash
# PowerShell
Get-Content .env

# Check specific variable
echo $env:DATABASE_URL
```

**Required minimum:**
- `DATABASE_URL`
- `REDIS_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

---

## Still Having Issues?

1. **Check the error message carefully** - it usually tells you what's wrong
2. **Search the error on GitHub** - someone likely had the same issue
3. **Check package versions** - ensure compatibility
4. **Read the logs** - full error context is in the console
5. **Start fresh** - sometimes a clean install fixes everything

---

## Useful Commands Reference

```bash
# Development
npm run dev              # Start Next.js
npm run worker           # Start background workers
npx prisma studio        # Open database GUI

# Database
npx prisma db push       # Apply schema changes
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Create migration

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs      # View logs

# Debugging
npm run build            # Test production build
npm run lint             # Check code quality
```

---

## Performance Tips

1. **Use Redis caching** - significantly speeds up API calls
2. **Add exchange API keys** - higher rate limits
3. **Adjust worker intervals** - balance freshness vs load
4. **Use production build** - faster than dev mode
5. **Deploy workers separately** - better scalability

---

**Last Updated:** November 2025  
**For more help:** Check README.md and SETUP.md

