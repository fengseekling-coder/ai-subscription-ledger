import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null };

/**
 * 桌面 WebView 发生未捕获渲染错误时，保留一个可见、不会写入数据的恢复提示，
 * 而不是只留下原生标题栏和白屏。
 */
class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app loading-screen" role="alert">
          <p>页面加载失败，但账本数据没有被修改。</p>
          <p>{this.state.error.message || "请重新启动应用。"}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
