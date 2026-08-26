# AI 订阅账本 - 项目清理脚本 (PowerShell 版本)
# 用途：删除旧构建产物、临时文件和测试数据
# 运行方式：powershell -ExecutionPolicy Bypass -File scripts\cleanup.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== AI 订阅账本 - 项目清理工具 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 清理 Tauri 构建产物 (target 目录)
Write-Host "[1/7] 清理 Rust/Tauri 构建产物..." -NoNewline
if (Test-Path "apps\desktop\src-tauri\target") {
    Remove-Item -Recurse -Force "apps\desktop\src-tauri\target"
    Write-Host " ✅ 已删除：apps/desktop/src-tauri/target/" -ForegroundColor Green
} else {
    Write-Host " ℹ️  未找到 Tauri target 目录" -ForegroundColor Yellow
}

# 2. 清理前端构建产物
Write-Host "[2/7] 清理前端构建产物..." -NoNewline
if (Test-Path "apps\desktop\dist") {
    Remove-Item -Recurse -Force "apps\desktop\dist"
    Write-Host " ✅ 已删除：apps/desktop/dist/" -ForegroundColor Green
} else {
    Write-Host " ℹ️  未找到 dist 目录" -ForegroundColor Yellow
}

# 3. 清理核心库构建产物
Write-Host "[3/7] 清理 @ai-sub/core 构建产物..." -NoNewline
if (Test-Path "packages\core\dist") {
    Remove-Item -Recurse -Force "packages\core\dist"
    Write-Host " ✅ 已删除：packages/core/dist/" -ForegroundColor Green
} else {
    Write-Host " ℹ️  未找到 core/dist 目录" -ForegroundColor Yellow
}

# 4. 清理日志文件
Write-Host "[4/7] 清理日志文件..." -NoNewline
Get-ChildItem -Recurse -Filter "*.log" -File | Remove-Item -Force
Write-Host " ✅ 已删除所有 .log 文件" -ForegroundColor Green

# 5. 清理临时构建产物（旧版本安装包）
Write-Host "[5/7] 清理旧版本安装包..." -NoNewline
$oldDMG = "apps\desktop\src-tauri\target\release\bundle\dmg\订阅账本_0.1.3_aarch64.dmg"
if (Test-Path $oldDMG) {
    Remove-Item -Force $oldDMG
    Write-Host " ✅ 已删除：订阅账本_0.1.3_aarch64.dmg" -ForegroundColor Green
}

# 6. 清理环境配置文件（如果存在）
Write-Host "[6/7] 清理环境配置文件..." -NoNewline
if (Test-Path ".env.local") {
    Remove-Item -Force ".env.local"
    Write-Host " ✅ 已删除：.env.local" -ForegroundColor Green
}
if (Test-Path ".env.development") {
    Remove-Item -Force ".env.development"
    Write-Host " ✅ 已删除：.env.development" -ForegroundColor Green
}

# 7. 清理数据库文件（可选 - 谨慎使用）
Write-Host "[7/7] 清理测试数据库文件..." -NoNewline
Get-ChildItem -Recurse -Include "*.db","*.sqlite","*.sqlite3" -File | 
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.git*" } |
    Remove-Item -Force
Write-Host " ✅ 已删除测试数据库文件" -ForegroundColor Green

Write-Host ""
Write-Host "=== 清理完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "注意事项:" -ForegroundColor Yellow
Write-Host "• 以下文件未被删除（在 .gitignore 中):" -ForegroundColor Cyan
Write-Host "  - node_modules/"
Write-Host "  - target/"
Write-Host "  - dist/"
Write-Host "  - *.log"
Write-Host "  - *.db, *.sqlite, *.sqlite3"
Write-Host ""
Write-Host "如果需要重新安装依赖，请运行：npm install" -ForegroundColor White
Write-Host "如果需要重新构建，请运行：npm run build" -ForegroundColor White
