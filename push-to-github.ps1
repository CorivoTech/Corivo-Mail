# ==========================================
# CORIVO MAIL - GIT PUSH SCRIPT
# Uses explicit git path to avoid Flutter conflict
# Works in PowerShell 5.1
# ==========================================

# ==========================================
# CONFIGURATION
# ==========================================

# Full path to correct git (Git for Windows)
$gitPath = "C:\Program Files\Git\bin\git.exe"

# Your codebase location
$codebasePath = "C:\Users\moham\Downloads\corivo-mail"

# GitHub repository URL
$githubRepo = "https://github.com/R-a-z-e-n/Mail.git"

# Commit message
$commitMsg = "Corivo Mail - Full implementation with Product & Technical Blueprint (Nov 2026)"

# ==========================================
# STEP 1: NAVIGATE TO CODEBASE
# ==========================================

Write-Host "📁 Navigating to codebase..." -ForegroundColor Cyan
Set-Location $codebasePath

# ==========================================
# STEP 2: GIT COMMANDS (Using explicit git path)
# ==========================================

Write-Host "🔧 Initializing git repository..." -ForegroundColor Cyan
& $gitPath init

Write-Host "➕ Adding all files..." -ForegroundColor Cyan
& $gitPath add .

Write-Host "📝 Creating commit..." -ForegroundColor Cyan
& $gitPath commit -m "$commitMsg"

# ==========================================
# STEP 3: REMOTE AND PUSH
# ==========================================

Write-Host "🔗 Adding remote origin..." -ForegroundColor Cyan
& $gitPath remote add origin $githubRepo

Write-Host "🌿 Renaming branch to main..." -ForegroundColor Cyan
& $gitPath branch -M main

Write-Host "⬆️ Pushing to GitHub..." -ForegroundColor Cyan
& $gitPath push -u origin main

# ==========================================
# COMPLETION
# ==========================================

Write-Host "=" * 50 -ForegroundColor White
Write-Host "🎉 PUSH COMPLETE!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor White
Write-Host "📍 Repository: $githubRepo" -ForegroundColor Cyan
Write-Host "✅ Your Corivo Mail codebase is now on GitHub!" -ForegroundColor Green
Write-Host "🌐 Visit: https://github.com/R-a-z-e-n/Mail" -ForegroundColor Cyan