#!/bin/bash
# AI 订阅账本 - 项目清理脚本
# 用途：删除旧构建产物、临时文件和测试数据

set -e

echo "=== AI 订阅账本 - 项目清理工具 ==="
echo ""

# 1. 清理 Tauri 构建产物 (target 目录)
echo "[1/7] 清理 Rust/Tauri 构建产物..."
if [ -d "apps/desktop/src-tauri/target" ]; then
    rm -rf apps/desktop/src-tauri/target
    echo "   ✅ 已删除：apps/desktop/src-tauri/target/"
else
    echo "   ℹ️  未找到 Tauri target 目录"
fi

# 2. 清理前端构建产物
echo "[2/7] 清理前端构建产物..."
if [ -d "apps/desktop/dist" ]; then
    rm -rf apps/desktop/dist
    echo "   ✅ 已删除：apps/desktop/dist/"
else
    echo "   ℹ️  未找到 dist 目录"
fi

# 3. 清理核心库构建产物
echo "[3/7] 清理 @ai-sub/core 构建产物..."
if [ -d "packages/core/dist" ]; then
    rm -rf packages/core/dist
    echo "   ✅ 已删除：packages/core/dist/"
else
    echo "   ℹ️  未找到 core/dist 目录"
fi

# 4. 清理日志文件
echo "[4/7] 清理日志文件..."
find . -name "*.log" -type f -delete 2>/dev/null || true
echo "   ✅ 已删除所有 .log 文件"

# 5. 清理临时构建产物（旧版本安装包）
echo "[5/7] 清理旧版本安装包..."
if [ -f "apps/desktop/src-tauri/target/release/bundle/dmg/订阅账本_0.1.3_aarch64.dmg" ]; then
    rm -f "apps/desktop/src-tauri/target/release/bundle/dmg/订阅账本_0.1.3_aarch64.dmg"
    echo "   ✅ 已删除：订阅账本_0.1.3_aarch64.dmg"
fi

# 6. 清理环境配置文件（如果存在）
echo "[6/7] 清理环境配置文件..."
if [ -f ".env.local" ]; then
    rm -f .env.local
    echo "   ✅ 已删除：.env.local"
fi

if [ -f ".env.development" ]; then
    rm -f .env.development
    echo "   ✅ 已删除：.env.development"
fi

# 7. 清理数据库文件（可选 - 谨慎使用）
echo "[7/7] 清理测试数据库文件..."
find . -maxdepth 2 -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" -type f | grep -v node_modules | while read file; do
    if [[ "$file" != *".git"* ]]; then
        rm -f "$file"
        echo "   ✅ 已删除：$file"
    fi
done

echo ""
echo "=== 清理完成 ==="
echo ""
echo "注意事项:"
echo "• 以下文件未被删除（在 .gitignore 中）:"
echo "  - node_modules/"
echo "  - target/"
echo "  - dist/"
echo "  - *.log"
echo "  - *.db, *.sqlite, *.sqlite3"
echo ""
echo "如果需要重新安装依赖，请运行：npm install"
echo "如果需要重新构建，请运行：npm run build"
