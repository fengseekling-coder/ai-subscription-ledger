# 🧹 项目清理指南

## 何时需要清理？

在以下情况下建议运行清理脚本：

1. **磁盘空间不足** - 构建产物占用大量空间
2. **依赖冲突** - node_modules 损坏或版本不一致
3. **构建失败** - 旧的编译缓存导致问题
4. **切换分支** - 从开发版切换到生产版前
5. **发布前准备** - 确保干净的构建环境

---

## 📦 清理内容概览

| 类型 | 路径 | 大小估计 | 说明 |
|------|------|---------|------|
| Rust 构建 | `apps/desktop/src-tauri/target/` | ~500MB-2GB | 包含 debug/release 编译产物 |
| 前端构建 | `apps/desktop/dist/` | ~5-20MB | Vite 打包的静态资源 |
| Core 构建 | `packages/core/dist/` | ~1-5MB | TypeScript 编译输出 |
| 日志文件 | `*.log` | <1MB | 运行时日志 |
| 数据库 | `*.db`, `*.sqlite` | ~1-10MB | 测试数据库文件 |
| 环境配置 | `.env.*` | <1KB | 本地环境变量 |

**总计可释放空间**: 约 **500MB - 2GB**（取决于构建历史）

---

## 🚀 快速清理

### macOS/Linux (Bash)

```bash
# 进入项目目录
cd /path/to/ai 账号订阅

# 执行清理
./scripts/cleanup.sh

# 或者使用 npm script（如果已配置）
npm run clean
```

### Windows (PowerShell)

```powershell
# 进入项目目录
cd C:\path\to\ai 账号订阅

# 执行清理（可能需要管理员权限）
powershell -ExecutionPolicy Bypass -File scripts\cleanup.ps1

# 或者手动运行
.\scripts\cleanup.ps1
```

---

## 🔧 手动清理步骤

如果不想使用脚本，可以手动删除：

### 1. 清理 Rust/Tauri 构建
```bash
# macOS/Linux
rm -rf apps/desktop/src-tauri/target

# Windows PowerShell
Remove-Item -Recurse -Force apps\desktop\src-tauri\target
```

### 2. 清理前端构建
```bash
# macOS/Linux
rm -rf apps/desktop/dist

# Windows PowerShell
Remove-Item -Recurse -Force apps\desktop\dist
```

### 3. 清理 Core 库构建
```bash
# macOS/Linux
rm -rf packages/core/dist

# Windows PowerShell
Remove-Item -Recurse -Force packages\core\dist
```

### 4. 清理日志和临时文件
```bash
# macOS/Linux
find . -name "*.log" -delete
find . -name "*.tmp" -delete

# Windows PowerShell
Get-ChildItem -Recurse -Filter "*.log" | Remove-Item
Get-ChildItem -Recurse -Filter "*.tmp" | Remove-Item
```

### 5. 清理测试数据库（谨慎！）
```bash
# ⚠️ 警告：这会删除所有 .db 文件，包括你的数据！
# 只在确定要重置测试环境时使用

# macOS/Linux
find . -maxdepth 2 -name "*.db" -delete

# Windows PowerShell
Get-ChildItem -Recurse -Include "*.db" | Remove-Item
```

---

## 🔄 清理后重建

清理完成后，需要重新安装依赖和构建：

### 完整重建流程

```bash
# 1. 安装 Node.js 依赖
npm install

# 2. 构建核心库
npm run build -w @ai-sub/core

# 3. 构建桌面前端
npm run build -w @ai-sub/desktop

# 4. 运行测试验证
npm test

# 5. 开发模式启动（可选）
npm run dev
```

### 生产构建

```bash
# macOS
npm run build
npm run tauri:build

# Windows (需在 Windows 环境)
npm run build
npm run tauri:build
```

---

## ⚠️ 注意事项

### 不会删除的文件
以下文件在 `.gitignore` 中，清理脚本**不会**删除：
- `node_modules/` - npm 依赖（需要 `npm install` 重装）
- `.git/` - Git 版本控制数据
- `*.log` - 日志文件（会被删除）
- `.env` - 环境变量配置（会被删除）

### 谨慎操作
- ❌ **不要删除** `.git/` 目录 - 会丢失所有版本历史
- ❌ **不要删除** `package-lock.json` - 会导致依赖版本不一致
- ⚠️ **谨慎删除** 数据库文件 - 可能包含重要用户数据

### 备份建议
在执行大规模清理前，建议备份：
```bash
# 备份整个项目（不包括 node_modules）
tar -czf backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=target \
  --exclude=dist \
  .

# 或者只备份数据
cp ~/.config/subscription-ledger/ledger.db ~/backup/
```

---

## 📊 磁盘空间优化

### 查看当前占用
```bash
# macOS/Linux
du -sh apps/desktop/src-tauri/target
du -sh apps/desktop/dist
du -sh packages/core/dist

# Windows PowerShell
(Get-ChildItem -Recurse apps\desktop\src-tauri\target | Measure-Object -Property Length -Sum).Sum / 1MB
```

### 预期释放空间
| 构建类型 | Debug | Release |
|---------|-------|---------|
| Rust/Tauri | ~500MB | ~200MB |
| 前端 (Vite) | ~10MB | ~5MB |
| Core (TypeScript) | ~2MB | ~1MB |
| **总计** | **~512MB** | **~206MB** |

---

## 🛠️ 自动化清理

### 添加到 package.json

可以在根 `package.json` 中添加清理命令：

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
npm run clean      # macOS/Linux
npm run clean:win  # Windows
npm run rebuild    # 完整重建
```

### CI/CD 集成

在 GitHub Actions 中自动清理：

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Clean previous builds
        run: |
          rm -rf apps/desktop/src-tauri/target
          rm -rf apps/desktop/dist
          rm -rf packages/core/dist
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test
```

---

## 🐛 常见问题

### Q1: 清理后 npm install 很慢？
**A**: 这是正常的，因为需要重新下载所有依赖。可以使用缓存加速：
```bash
# 使用 npm cache
npm cache verify
npm install --prefer-offline
```

### Q2: 清理后构建失败？
**A**: 尝试完全重建：
```bash
# 删除所有构建产物和依赖
rm -rf node_modules apps/desktop/src-tauri/target
npm install
npm run build
```

### Q3: Windows 上权限错误？
**A**: 以管理员身份运行 PowerShell：
```powershell
# 右键点击 PowerShell → "以管理员身份运行"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\cleanup.ps1
```

### Q4: 如何只清理特定部分？
**A**: 可以注释掉脚本中不需要的部分，或手动执行单个命令。

---

## 📞 获取帮助

如果遇到问题：
1. 检查 [GitHub Issues](https://github.com/fengseekling-coder/ai-subscription-ledger/issues)
2. 查看 [docs/windows-build-guide.md](./docs/windows-build-guide.md)
3. 联系维护者：hello@azhuilab.com

---

**最后更新**: 2026-07-31  
**维护者**: azhuilab team
