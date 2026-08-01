---
kind: frontend_style
name: 基于 CSS 变量与主题预设的轻量级桌面端样式系统
category: frontend_style
scope:
    - '**'
source_files:
    - apps/desktop/src/styles.css
    - apps/desktop/src/theme.ts
    - apps/desktop/src/main.tsx
    - apps/desktop/package.json
---

该桌面端应用采用纯 CSS + CSS 变量（CSS Custom Properties）构建样式体系，未引入 Tailwind、Styled Components、Emotion 等第三方样式库或 CSS-in-JS 框架。样式集中在 `apps/desktop/src/styles.css` 一个文件中，通过 `:root` 定义全局设计令牌（design tokens），并以 BEM 风格命名类名组织组件样式。

**设计令牌体系**：在 `styles.css` 顶部集中声明所有视觉变量，包括背景/表面色（`--bg`、`--surface`、`--surface-raised`）、文本层级（`--text`、`--text-secondary`、`--text-tertiary`）、强调色（`--accent` 系列）、语义色（`--ok`、`--warn`、`--danger`）、分类色（`--category-dev/design/office`）、间距（`--space-1`~`--space-8`）、圆角（`--radius-sm`~`--radius-xl`）、字体族与字号阶梯、阴影层级等。所有 UI 元素通过引用这些变量实现视觉一致性。

**暗色模式支持**：通过 `@media (prefers-color-scheme: dark)` 和 `:root[data-theme="dark"]` 两套机制覆盖同一组 CSS 变量，实现跟随系统或手动切换的深色模式。JS 侧通过 `theme.ts` 中的 `applyAppearance()` 函数动态设置 `data-theme` 属性并内联注入强调色变量，优先级高于 CSS 媒体查询，确保用户选择的强调色在明/暗模式下均生效。

**主题预设系统**：`theme.ts` 定义了 6 种强调色预设（green/blue/indigo/teal/violet/slate），每种预设包含 light/dark 两套色值，通过 `ACCENT_ORDER` 控制设置页展示顺序。强调色仅驱动单一强调用途（进度条、焦点环、链接、选中态），主按钮保持近黑/反白，保证整体克制干净的视觉风格。

**响应式策略**：使用两个断点（900px、600px）进行移动端适配，主要调整网格布局（metrics/stats-grid 从多列变为单列）、表单行布局、间距和导航栏布局。

**组件样式约定**：采用 BEM 命名规范（如 `.topbar__inner`、`.metric__value`、`.modal__panel`），通过统一的 spacing、radius、shadow 变量保持组件间视觉一致性。按钮、表单、模态框、表格、标签等通用组件样式均在 styles.css 中统一定义，避免重复。

**构建集成**：通过 Vite 直接导入 `styles.css`（见 `main.tsx`），无额外样式预处理步骤。项目依赖中不包含任何 CSS 框架或预处理器，保持最小化依赖。