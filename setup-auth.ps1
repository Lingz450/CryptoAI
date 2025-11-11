# GhostFX Authentication Setup Script
# Run this after adding your DATABASE_URL to .env

Write-Host "`n🚀 GhostFX Authentication Setup`n" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file first (copy from .env.local.example)" -ForegroundColor Yellow
    exit 1
}

# Check if DATABASE_URL is set
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch 'DATABASE_URL="postgresql://') {
    Write-Host "⚠️  Warning: DATABASE_URL not configured!" -ForegroundColor Yellow
    Write-Host "`nPlease follow these steps:" -ForegroundColor White
    Write-Host "1. Visit https://neon.tech (free PostgreSQL database)" -ForegroundColor White
    Write-Host "2. Sign up and create a project" -ForegroundColor White
    Write-Host "3. Copy your connection string" -ForegroundColor White
    Write-Host "4. Paste it in .env as DATABASE_URL" -ForegroundColor White
    Write-Host "5. Run this script again`n" -ForegroundColor White
    
    Write-Host "Need help? Read QUICK_SETUP.md`n" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Found .env file with DATABASE_URL`n" -ForegroundColor Green

# Step 1: Push database schema
Write-Host "📊 Step 1: Pushing database schema..." -ForegroundColor Cyan
try {
    npx prisma db push --accept-data-loss
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database schema pushed successfully!`n" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to push database schema" -ForegroundColor Red
        Write-Host "Check your DATABASE_URL in .env file`n" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Error pushing database schema: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Generate Prisma Client
Write-Host "🔧 Step 2: Generating Prisma Client..." -ForegroundColor Cyan
try {
    npx prisma generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Prisma Client generated successfully!`n" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error generating Prisma Client: $_" -ForegroundColor Red
    exit 1
}

# Success!
Write-Host "`n🎉 Authentication Setup Complete!" -ForegroundColor Green
Write-Host "`n✅ You can now:" -ForegroundColor White
Write-Host "   • Visit http://localhost:3001/dashboard" -ForegroundColor White
Write-Host "   • Create user accounts" -ForegroundColor White
Write-Host "   • Set up alerts and watchlists" -ForegroundColor White
Write-Host "   • Save trade setups" -ForegroundColor White

Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Restart your dev server (npm run dev)" -ForegroundColor White
Write-Host "   2. Visit http://localhost:3001/dashboard" -ForegroundColor White
Write-Host "   3. Sign in with any email" -ForegroundColor White
Write-Host "   4. Copy the magic link from terminal" -ForegroundColor White

Write-Host "`n🚀 Happy trading with GhostFX!`n" -ForegroundColor Cyan

