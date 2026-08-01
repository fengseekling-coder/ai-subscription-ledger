# AI 订阅账本 Windows 版本开发指南

## 📦 项目概述

本项目现已支持跨平台（macOS + Windows），使用 Tauri 2 框架结合 Rust 后端与 React 前端实现原生桌面应用。

### 技术栈
- **Tauri 2**: 跨平台桌面应用框架
- **Rust 后端**: OCR (tesseract), 数据库加密存储，系统托盘
- **React 19 + TypeScript**: 现代前端界面
- **SQLite**: 本地持久化存储
- **Aes-GCM**: 用户数据加密

---

## 🖥️ Windows 环境配置

### 前置依赖

#### 1. Node.js 环境
```bash
# Windows 10/11
# 建议使用 nvm-windows 或下载官方安装包
# https://nodejs.org/

# 验证安装
node -v
npm -v
```

**最低要求**: Node.js 18.x (推荐 20.x LTS)

#### 2. Rust 工具链
```powershell
# 从官网下载：https://rustup.rs/
# 或使用 PowerShell:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | iex

# 添加 Windows 特定组件
rustup component add rust-src
```

**验证安装**:
```bash
rustc --version
cargo --version
```

#### 3. C++ Build Tools for Visual Studio

Tesseract OCR 和其他原生库的编译需要：

**Visual Studio 2019/2022 Community Edition**
- 安装时勾选：**"桌面开发 with C++"**
- 确保包含以下工作负载：
  - Windows 10 SDK
  - MSVC v143 - VS 2022 C++ x64/x86

**或者单独安装 Build Tools**:
```powershell
# 下载并运行
Invoke-WebRequest "https://aka.ms/vs/17/release/vs_buildtools.exe" -OutFile "./vs_buildtools.exe"
.\vs_buildtools.exe --quiet --wait --norestart --nocache `
  --add Microsoft.VisualStudio.Workload.VCTools `
  --add Microsoft.VisualStudio.Component.Windows10SDK.19041
```

#### 4. Python (用于 tesseract-rs 绑定)

```bash
# 建议安装 Python 3.8+
python --version
pip --version
```

#### 5. Tesseract OCR Engine (可选 - 预编译版会自带依赖)

如果使用系统安装的 Tesseract，需要在 PATH 中添加：

```powershell
# 从 https://github.com/UB-Mannheim/tesseract/wiki 下载最新版
# 安装后添加到环境变量 PATH:
$env:Path += ";C:\Program Files\Tesseract-OCR"

# 验证
tesseract --version
```

**注意**: `tesseract-rs` crate 会自动查找系统 Tesseract，也可以打包静态编译版本。

---

## 🚀 首次构建流程

### 1. 克隆项目
```bash
cd /d [项目目录]
git clone <repository-url>
cd ai账号订阅
```

### 2. 安装依赖
```bash
# 安装 Node.js 依赖
npm install

# 验证所有子包已链接
npm run build -w @ai-sub/core
```

### 3. 首次构建 Tauri (包含 Rust 编译)
```bash
# Windows 专用构建脚本
npm run tauri:build

# 或使用命令式方式
npm run build
npm run tauri:build
```

### 4. 构建输出位置
```
apps/desktop/src-tauri/target/release/
├── bundle/
│   ├── msi/
│   │   └── subscription_ledger_0.1.3.msi       # Windows 安装包
│   └── nsis/
│       ├── subscription-ledger-setup-0.1.3.exe # NSIS 安装向导
│       └── subscription-ledger-0.1.3.zip
```

---

## 🔧 开发模式启动

### 热重载开发
```bash
# 自动启动 Tauri 窗口 + 热重载 React
npm run dev
```

### 只启动前端调试
```bash
npm run dev:web
# http://localhost:3000
```

### 只构建核心业务逻辑
```bash
npm run build -w @ai-sub/core
```

---

## 🛠️ 关键文件说明

### 配置文件
| 文件 | 作用 |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri 应用配置（目标格式、图标、证书） |
| `src-tauri/Cargo.toml` | Rust 依赖管理（OCR、数据库等） |
| `package.json` | Node.js 依赖与工作空间管理 |
| `tsconfig.json` | TypeScript 编译器配置 |

### 核心模块
| 路径 | 功能 |
|------|------|
| `src-tauri/src/lib.rs` | Tauri commands, tray menu, background monitor |
| `src-tauri/src/db.rs` | SQLite 数据库交互与状态持久化 |
| `src-tauri/src/ocr.rs` | 跨平台 OCR 接口实现 (tesseract) |
| `src-tauri/src/monitor.rs` | 第三方 API 监控与通知检查 |
| `src/` | React 前端组件、状态管理、UI 逻辑 |

---

## 📦 Windows 打包配置详解

### MSI 安装包配置
在 `tauri.conf.json`:
```json
{
  "bundle": {
    "targets": ["msi", "nsis"],
    "windows": {
      "certificateThumbprint": null,  // 代码签名证书指纹
      "timestampUrl": "",              // 时间戳服务器 URL
      "wix": {
        "language": "zh-CN",
        "template": "main.wxs"         // 自定义 WIX 模板
      }
    }
  }
}
```

### NSIS 安装向导配置
```json
{
  "nsis": {
    "installerIcon": "icons/icon.ico",
    "sidebarImage": null,     // 侧边栏图片
    "headerImage": null,      // 顶部图片
    "languages": ["SimpChinese"]
  }
}
```

---

## 🔐 代码签名 (生产环境必需)

### Windows 代码签名步骤

#### 1. 获取证书
从受信任的 CA 购买 EV Code Signing Certificate:
- DigiCert
- GlobalSign
- Sectigo

#### 2. 配置签名
```powershell
# 将 PFX 证书转换为 DER 格式
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
    "path/to/certificate.pfx",
    "password",
    "MachineKeySet"
)
$thumbprint = $cert.Thumbprint
Write-Output $thumbprint
```

#### 3. 更新配置
```json
// src-tauri/tauri.conf.json
{
  "windows": {
    "certificateThumbprint": "<你的证书指纹>",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

---

## 🧪 测试策略

### 单元测试
```bash
# 运行核心业务逻辑测试
npm test -w @ai-sub/core

# 运行桌面端 UI 测试
npm run test:desktop
```

### E2E 测试
计划集成 Playwright:
```bash
npx playwright init
npx playwright test
```

---

## 🎯 性能优化建议

### 1. 增量编译加速
```bash
# 仅构建未修改的 crates
CARGO_INCREMENTAL=1 npm run tauri:build

# 启用 LTO
[profile.release]
lto = true
codegen-units = 1
opt-level = "s"
strip = true
```

### 2. 前端资源优化
- Gzip 压缩静态资源
- 图片 WebP 格式
- Tree shaking 去除死代码

---

## 🚨 常见错误排查

### Rust 编译失败
```
error: failed to run custom build command for ...

# 解决方案:
# 1. 确保安装了 Visual Studio C++ 工具
# 2. 清除缓存重新编译
cargo clean && cargo build --release
```

### Tesseract 动态库缺失
```
The code loading request for DLL 'libtesseract-5.dll' failed
```
**解决方案**: 
```bash
# 方法 1: 安装系统版 Tesseract
winget install tesseract-ocr

# 方法 2: 在 dist 目录下放置 libtesseract.dll
copy "C:\Program Files\Tesseract-OCR\tesseract.dll" apps/desktop/dist/
```

### 托盘菜单不显示
```rust
// 确认托盘图标来源正确
.tray_icon_event(|tray, event| {
    let app = tray.app_handle();  // ✅ 跨平台兼容写法
});
```

---

## 🌐 CI/CD 自动化构建

### GitHub Actions 示例
```yaml
name: Windows CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build core
        run: npm run build -w @ai-sub/core
      
      - name: Run tests
        run: npm run test:desktop
      
      - name: Build Tauri app
        run: npm run tauri:build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📞 支持与反馈

遇到问题？请通过以下方式反馈：
- GitHub Issues: 提交 Bug 报告和功能请求
- 开发者社区：加入我们的 Slack/Discord

---

## 📜 许可协议

本项目遵循 MIT 开源协议。详细请参阅 [LICENSE](../LICENSE) 文件。

---

**最后更新时间**: 2026-07-31  
**维护者**: azhuilab team
