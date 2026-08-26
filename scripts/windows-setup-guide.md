# Windows 开发者快速上手脚本

## 🎯 用途
为 Windows 开发者提供自动化环境检查和初始化脚本。

---

## 📋 前置条件检查

### PowerShell 脚本 (Check System Requirements)

将以下内容保存为 `scripts/check-windows-env.ps1`:

```powershell
# AI 订阅账本 - Windows 环境检查脚本
# 运行方式: powershell -ExecutionPolicy Bypass -File scripts\check-windows-env.ps1

Write-Host "=== AI 订阅账本 Windows 环境检查 ===" -ForegroundColor Cyan
Write-Host ""

$errors = @()
$warnings = @()
$suggestions = @()

# 1. Node.js 检查
Write-Host "[1/6] 检查 Node.js ..." -NoNewline
try {
    $nodeVersion = node --version 2>&1
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
    
    # 检查版本号 >= 18.x
    $version = [Version]($nodeVersion.TrimStart('v'))
    if ($version -lt [Version]"18.0.0") {
        $warnings += "Node.js 版本过低，建议升级到 20.x LTS"
    }
} catch {
    $errors += "未找到 Node.js，请从 https://nodejs.org/ 下载安装"
}

# 2. npm 检查
Write-Host "[2/6] 检查 npm ..." -NoNewline
try {
    $npmVersion = npm --version 2>&1
    Write-Host " ✅ v$npmVersion" -ForegroundColor Green
} catch {
    $errors += "npm 不可用（可能是 Node.js 安装问题）"
}

# 3. Rust 检查
Write-Host "[3/6] 检查 Rust ..." -NoNewline
try {
    $rustcVersion = rustc --version 2>&1
    $cargoVersion = cargo --version 2>&1
    Write-Host " ✅ $rustcVersion, Cargo $cargoVersion" -ForegroundColor Green
    
    # 检查 rust-src
    try {
        rustup component list | Select-String "rust-src" | Out-Null
        if ($?) {
            Write-Host "    - rust-src component: ✅ installed" -ForegroundColor DarkGreen
        } else {
            $suggestions += "建议安装 rust-src 组件：rustup component add rust-src"
        }
    } catch {
        $suggestions += "需要安装 rust-src 组件"
    }
} catch {
    $errors += "未找到 Rust，请从 https://rustup.rs/ 下载安装"
}

# 4. Visual Studio C++ Build Tools
Write-Host "[4/6] 检查 Visual Studio C++ Build Tools ..." -NoNewline
$candidatePaths = @(
    "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC",
    "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Tools\MSVC",
    "$env:ProgramFiles\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC"
)

$vsFound = $false
foreach ($path in $candidatePaths) {
    if (Test-Path $path) {
        Write-Host " ✅ Found at: $($path.Split('\')[-1])" -ForegroundColor Green
        $vsFound = $true
        break
    }
}

if (-not $vsFound) {
    $errors += "未找到 Visual Studio C++ Build Tools，请下载并安装：https://visualstudio.microsoft.com/visual-cpp-build-tools/"
}

# 5. Python 检查
Write-Host "[5/6] 检查 Python ..." -NoNewline
try {
    $pythonVersion = python --version 2>&1
    Write-Host " ✅ $pythonVersion" -ForegroundColor Green
} catch {
    $warnings += "建议安装 Python 3.8+ (用于 tesseract-rs 编译)" -ForegroundColor Yellow
}

# 6. Tesseract OCR
Write-Host "[6/6] 检查 Tesseract OCR ..." -NoNewline
$tesseractPath = Get-Command tesseract -ErrorAction SilentlyContinue
if ($tesseractPath) {
    $tesseractVersion = tesseract --version 2>&1 | Select-String "tesseract.*"
    Write-Host " ✅ $tesseractVersion" -ForegroundColor Green
} else {
    $warnings += "Tesseract OCR 未安装（可选，构建会尝试静态链接）"
    $suggestions += "如需手动安装：winget install tesseract-ocr"
}

# --- 输出结果汇总 ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "检查结果:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ 错误 (必须修复):" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  • $error" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️ 警告 (建议处理):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($suggestions.Count -gt 0) {
    Write-Host "💡 建议:" -ForegroundColor Cyan
    foreach ($suggestion in $suggestions) {
        Write-Host "  • $suggestion" -ForegroundColor Cyan
    }
    Write-Host ""
}

# --- 决策逻辑 ---
if ($errors.Count -eq 0) {
    Write-Host "✅ 环境准备就绪！可以继续开发：" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步操作:" -ForegroundColor White
    Write-Host "  1. cd /d [项目目录]" -ForegroundColor Gray
    Write-Host "  2. npm install           # 安装依赖" -ForegroundColor Gray
    Write-Host "  3. npm run dev           # 启动开发服务器" -ForegroundColor Gray
    Write-Host "  4. npm run build         # 生产构建" -ForegroundColor Gray
} else {
    Write-Host "❌ 环境不完整，请先修复上述错误再继续使用" -ForegroundColor Red
    exit 1
}

exit 0
```

---

## 🚀 安装依赖脚本

将以下内容保存为 `scripts/setup-windows.ps1`:

```powershell
# AI 订阅账本 - Windows 环境设置脚本
# 首次运行前的完整初始化

param(
    [string]$ProjectPath
)

$projectPath = if ($ProjectPath) {
    $ProjectPath
} else {
    $PSScriptRoot
}

Set-Location $projectPath

Write-Host "开始设置 AI 订阅账本 Windows 环境..." -ForegroundColor Cyan

# 1. 安装 Node.js 依赖
Write-Host "`n[1/3] 安装 NPM 依赖..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：NPM 安装失败" -ForegroundColor Red
    exit 1
}

# 2. 验证子包链接
Write-Host "[2/3] 验证工作空间链接..." -ForegroundColor Yellow
npm run build -w @ai-sub/core
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：核心包构建失败" -ForegroundColor Red
    exit 1
}

# 3. 清理旧构建产物
Write-Host "[3/3] 清理旧构建产物..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "apps/desktop/src-tauri/target\release\bundle" -ErrorAction SilentlyContinue
Write-Host "✓ 清理完成" -ForegroundColor Green

Write-Host "`n✅ 环境设置完成!" -ForegroundColor Green
Write-Host "`n可以执行以下命令:" -ForegroundColor Cyan
Write-Host "  • npm run dev          # 开发模式" -ForegroundColor Gray
Write-Host "  • npm run tauri:build  # 生产构建" -ForegroundColor Gray
Write-Host "  • npm test             # 运行测试" -ForegroundColor Gray
```

---

## 🔧 常见问题自动修复

将以下内容保存为 `scripts/fix-windows-issues.ps1`:

```powershell
# Windows 常见错误自动修复脚本

Write-Host "=== 常见问题修复工具 ===" -ForegroundColor Cyan

$choice = Read-Host "请选择要修复的问题 (1-3):`n1. 修复 C++ 构建工具缺失`n2. 重新安装 Rust 组件`n3. 更新 Tauri CLI"
switch ($choice) {
    "1" {
        Write-Host "正在下载 Visual Studio Build Tools..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vs_buildtools.exe" `
                          -OutFile "$env:TEMP\vs_buildtools.exe"
        
        Start-Process "$env:TEMP\vs_buildtools.exe" -ArgumentList "--quiet","--wait","--norestart","--nocache",
            "--add","Microsoft.VisualStudio.Workload.VCTools","--add","Microsoft.VisualStudio.Component.Windows10SDK.19041"
        
        Write-Host "下载完成，请手动运行安装包并选择'桌面开发与 C++'" -ForegroundColor Green
    }
    "2" {
        Write-Host "添加 rust-src 组件..." -ForegroundColor Yellow
        rustup component add rust-src
        rustup update
        Write-Host "Rust 已更新" -ForegroundColor Green
    }
    "3" {
        Write-Host "更新 Tauri CLI..." -ForegroundColor Yellow
        npm install -g @tauri-apps/cli@latest
        Write-Host "Tauri CLI 已更新" -ForegroundColor Green
    }
    default {
        Write-Host "无效选择" -ForegroundColor Red
    }
}
```

---

## 📞 使用指南

### 首次设置 Windows 开发环境

```powershell
# 1. 进入项目目录
cd "C:\Users\YourName\Projects\ai 账号订阅"

# 2. 检查系统要求
.\scripts\check-windows-env.ps1

# 3. 如果有问题，执行修复
.\scripts\fix-windows-issues.ps1

# 4. 安装依赖
.\scripts\setup-windows.ps1

# 5. 启动开发模式
npm run dev
```

### 生产环境构建

```powershell
# 确保所有检查通过
.\scripts\check-windows-env.ps1

# 构建应用
npm run build
npm run tauri:build

# 安装包位置：
# target\release\bundle\msi\*.msi
# target\release\bundle\nsis\*-setup-*.exe
```

---

## 🔍 调试支持

如果遇到构建问题，收集诊断信息:

```powershell
# 生成完整诊断报告
.\scripts\diagnose-windows.ps1

# 报告包含:
# - 环境变量快照
# - PATH 中关键工具的检测
# - .NET 版本信息
# - 磁盘空间检查
```

---

**维护**: azhuilab team  
**最后更新**: 2026-07-31
