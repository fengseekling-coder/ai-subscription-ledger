import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  // 用了假时钟的用例结束后必须还原，否则会污染后面的用例。
  vi.useRealTimers();
});

// Tauri 运行时在 jsdom 里不存在。组件靠 `"__TAURI_INTERNALS__" in window` 判断环境，
// 保持「不存在」即走纯浏览器分支；需要 Tauri 行为的用例各自 vi.mock。
