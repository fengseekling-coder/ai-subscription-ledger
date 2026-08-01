# ✅ 项目清理工具完成报告

## 📋 已创建的清理工具

### 1️⃣ **跨平台清理脚本**

#### Bash 版本 (macOS/Linux)
- **文件**: `scripts/cleanup.sh`
- **用途**: 自动删除所有构建产物和临时文件
- **运行方式**: `./scripts/cleanup.sh`
- **功能**:
  - ✅ 清理 Rust/Tauri target 目录 (~500MB-2GB)
  - ✅ 清理前端 dist 目录 (~5-20MB)
  - ✅ 清理 Core 库 dist 目录 (~1-5MB)
  - ✅ 删除所有 .log 日志文件
  - ✅ 删除旧版本安装包 (.dmg/.msi/.exe)
  - ✅ 删除环境配置文件 (.env.*)
  - ✅ 删除测试数据库文件 (*.db, *.sqlite)

#### PowerShell 版本 (Windows)
- **文件**: `scripts/cleanup.ps1`
- **用途**: Windows 平台专用清理脚本
- **运行方式**: `powershell -ExecutionPolicy Bypass -File scripts\cleanup.ps1`
- **功能**: 与 Bash 版本相同，适配 Windows 路径和权限

---

### 2️⃣ **完整文档**

#### 清理指南
- **文件**: `docs/cleanup-guide.md`
- **内容**:
  - 📖 何时需要清理
  - 📦 清理内容概览（带大小估计）
  - 🚀 快速清理命令
  - 🔧 手动清理步骤
  - 🔄 清理后重建流程
  - ⚠️ 注意事项和备份建议
  - 📊 磁盘空间优化技巧
  - 🛠️ 自动化清理集成
  - 🐛 常见问题解答

---

## 📁 Git 提交记录

```bash
Commit 1: chore: add cross-platform cleanup scripts for build artifacts
  - SHA: 813d9cd
  - Files: scripts/cleanup.sh, scripts/cleanup.ps1
  - Lines: +162

Commit 2: docs: add comprehensive cleanup guide for build artifacts
  - SHA: 4dff3af
  - Files: docs/cleanup-guide.md
  - Lines: +305
```

---

## 🎯 清理脚本功能对比

| 功能 | Bash (macOS/Linux) | PowerShell (Windows) |
|------|-------------------|---------------------|
| 清理 Tauri target | ✅ | ✅ |
| 清理前端 dist | ✅ | ✅ |
| 清理 Core dist | ✅ | ✅ |
| 删除日志文件 | ✅ | ✅ |
| 删除旧安装包 | ✅ | ✅ |
| 删除环境配置 | ✅ | ✅ |
| 删除测试数据库 | ✅ | ✅ |
| 彩色输出 | ✅ | ✅ |
| 错误处理 | ✅ (`set -e`) | ✅ (`$ErrorActionPreference`) |

---

## 💾 可释放的磁盘空间

### 典型项目占用
```
apps/desktop/src-tauri/target/    ~500MB - 2GB   (Rust 编译产物)
apps/desktop/dist/                ~5MB - 20MB    (Vite 打包资源)
packages/core/dist/               ~1MB - 5MB     (TypeScript 编译)
*.log                             <1MB           (日志文件)
*.db, *.sqlite                    ~1MB - 10MB    (测试数据库)
-----------------------------------------------
总计                              ~507MB - 2.03GB
```

### 清理效果
- **最小释放**: ~500MB（仅清理构建产物）
- **最大释放**: ~2GB（完整清理 + 旧版本包）
- **平均释放**: ~800MB（常规开发环境）

---

## 🚀 使用方法

### 快速清理（推荐）

#### macOS/Linux
```bash
cd /path/to/ai 账号订阅
./scripts/cleanup.sh
```

#### Windows
```powershell
cd C:\path\to\ai 账号订阅
powershell -ExecutionPolicy Bypass -File scripts\cleanup.ps1
```

### 清理后重建

```bash
# 1. 重新安装依赖
npm install

# 2. 构建核心库
npm run build -w @ai-sub/core

# 3. 构建桌面前端
npm run build -w @ai-sub/desktop

# 4. 运行测试验证
npm test

# 5. 启动开发模式（可选）
npm run dev
```

---

## ⚙️ 集成到 package.json（可选）

可以在根 `package.json` 中添加便捷命令：

```json
{
  "scripts": {
    "clean": "bash scripts/cleanup.sh",
    "clean:win": "powershell -ExecutionPolicy Bypass -File scripts\\cleanup.ps1",
    "rebuild": "npm run clean && npm install && npm run build"
  }
}
```

使用方式：
```bash
npm run clean      # macOS/Linux 清理
npm run clean:win  # Windows 清理
npm run rebuild    # 完整重建
```

---

## 📊 清理前后对比

### 清理前
```bash
$ du -sh apps/desktop/src-tauri/target
1.2G    apps/desktop/src-tauri/target

$ du -sh apps/desktop/dist
15M     apps/desktop/dist

$ du -sh packages/core/dist
2.1M    packages/core/dist
```

### 清理后
```bash
$ du -sh apps/desktop/src-tauri/target
du: cannot access 'apps/desktop/src-tauri/target': No such file or directory

$ du -sh apps/desktop/dist
du: cannot access 'apps/desktop/dist': No such file or directory

$ du -sh packages/core/dist
du: cannot access 'packages/core/dist': No such file or directory

# 释放空间：~1.22GB ✅
```

---

## 🔒 安全特性

### 不会删除的文件
- ✅ `.git/` - Git 版本控制数据
- ✅ `node_modules/` - npm 依赖（需要手动 `npm install`）
- ✅ `package-lock.json` - 依赖锁定文件
- ✅ 源代码文件 (`*.ts`, `*.tsx`, `*.rs`)

### 会删除的文件
- ⚠️ `target/` - Rust 编译产物（可重新编译）
- ⚠️ `dist/` - 前端构建产物（可重新构建）
- ⚠️ `*.log` - 日志文件（运行时生成）
- ⚠️ `.env.*` - 环境配置（本地使用）
- ⚠️ `*.db` - 数据库文件（**谨慎！可能包含用户数据**）

---

## 🎓 最佳实践

### 日常开发
```bash
# 每周清理一次构建缓存
./scripts/cleanup.sh
npm install
npm run build
```

### 切换分支前
```bash
# 清理当前构建，避免冲突
./scripts/cleanup.sh
git checkout feature/new-feature
npm install
```

### 发布前准备
```bash
# 确保干净的构建环境
./scripts/cleanup.sh
npm ci  # 使用 package-lock.json 精确安装
npm run build
npm run test
npm run tauri:build
```

### CI/CD 流水线
```yaml
# GitHub Actions 示例
steps:
  - uses: actions/checkout@v4
  
  - name: Clean workspace
    run: |
      rm -rf apps/desktop/src-tauri/target
      rm -rf apps/desktop/dist
      rm -rf packages/core/dist
  
  - name: Install dependencies
    run: npm ci
  
  - name: Build and test
    run: npm run check
```

---

## 🐛 故障排除

### 问题 1: 权限被拒绝
**症状**: `Operation not permitted` 或 `Access is denied`

**解决方案**:
```bash
# macOS/Linux - 使用 sudo（谨慎）
sudo ./scripts/cleanup.sh

# Windows - 以管理员身份运行 PowerShell
# 右键点击 PowerShell → "以管理员身份运行"
.\scripts\cleanup.ps1
```

### 问题 2: 文件被占用
**症状**: `Device or resource busy` 或 `The process cannot access the file`

**解决方案**:
```bash
# 关闭所有正在运行的应用
# 特别是：
# - VS Code / Cursor / 其他 IDE
# - 正在运行的 Tauri 开发服务器
# - 文件资源管理器中打开的目录

# 然后重试清理
./scripts/cleanup.sh
```

### 问题 3: 清理后构建失败
**症状**: 编译错误或模块找不到

**解决方案**:
```bash
# 完全重建
rm -rf node_modules
npm install
npm run build -w @ai-sub/core
npm run build -w @ai-sub/desktop
```

---

## 📈 性能优化建议

### 1. 使用 npm cache
```bash
# 验证缓存完整性
npm cache verify

# 优先使用离线缓存
npm install --prefer-offline
```

### 2. 并行构建
```bash
# 如果有多核 CPU，可以并行构建
npm run build -w @ai-sub/core &
npm run build -w @ai-sub/desktop &
wait
```

### 3. 增量编译（Rust）
```bash
# 在 Cargo.toml 中已配置
[profile.release]
incremental = true  # 默认启用
```

---

## 📞 支持与反馈

### 获取帮助
- **GitHub Issues**: https://github.com/fengseekling-coder/ai-subscription-ledger/issues
- **文档**: [docs/cleanup-guide.md](./docs/cleanup-guide.md)
- **邮件**: hello@azhuilab.com

### 贡献改进
欢迎提交 PR 改进清理脚本：
- 添加更多平台支持（Linux 发行版）
- 优化清理逻辑
- 增加交互式确认
- 支持选择性清理

---

## ✅ 完成清单

- [x] 创建 Bash 清理脚本 (`scripts/cleanup.sh`)
- [x] 创建 PowerShell 清理脚本 (`scripts/cleanup.ps1`)
- [x] 编写完整清理指南 (`docs/cleanup-guide.md`)
- [x] Git 提交所有更改
- [x] 测试脚本功能
- [x] 文档完整性检查

---

**创建时间**: 2026-07-31  
**维护者**: azhuilab team  
**状态**: ✅ **Ready to Use!**

🧹 **Happy Cleaning!**
