---
kind: external_dependency
name: Vite 6 + React 19 前端构建
slug: vite-react
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - apps/desktop/package.json
    - apps/desktop/tsconfig.json
---

桌面端前端使用 Vite 6 作为开发服务器与打包工具，React 19 作为 UI 框架，vitest 4 运行单元测试（jsdom + Testing Library）。TypeScript 5.7 编译，ESLint 9 配合 react-hooks 插件做静态检查。