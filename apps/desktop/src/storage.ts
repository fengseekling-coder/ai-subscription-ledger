import type { AppState } from "@ai-sub/core";
import { loadFromJson } from "@ai-sub/core";
import { invoke } from "@tauri-apps/api/core";

type Dto = {
  budget: number;
  rows: unknown[];
  bills: unknown[];
  language?: string;
  appearance?: unknown;
};

/** 纯浏览器环境（vite dev 预览/截图）下没有 Tauri 运行时 */
const isBrowser = () =>
  typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);

/** 相对今天偏移天数的 ISO 日期（让预览数据的状态永远真实） */
function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 浏览器预览用的演示账本（不影响 Tauri 正式数据） */
function browserDemoState(): AppState {
  const rows = [
    { id: "demo-1", category: "官方", plan: "ChatGPT Plus", fee: "US$20", subscribed: true, usage: "AI 对话月付", dueDate: iso(1), subscribedAt: iso(-20), expired: false },
    { id: "demo-2", category: "官方", plan: "Claude Pro", fee: "US$20", subscribed: true, usage: "Anthropic 月付", dueDate: iso(2), subscribedAt: iso(-16), expired: false },
    { id: "demo-3", category: "官方", plan: "GitHub Copilot Pro", fee: "US$10", subscribed: true, usage: "开发助手月付", dueDate: iso(0), subscribedAt: iso(-30), expired: false },
    { id: "demo-4", category: "中转", plan: "API 中转站·月卡", fee: "49", subscribed: true, usage: "GPT/Claude 通用", dueDate: iso(13), subscribedAt: iso(-17), expired: false },
    { id: "demo-5", category: "官方", plan: "Midjourney Basic", fee: "US$10", subscribed: true, usage: "图像生成月付", dueDate: iso(-2), subscribedAt: iso(-32), expired: false },
    { id: "demo-6", category: "中转额度包", plan: "额度包 100 元（不限时）", fee: "100", subscribed: true, usage: "按量扣减", dueDate: "", subscribedAt: iso(-9), expired: false },
    { id: "demo-7", category: "官方", plan: "Notion Plus", fee: "US$12", subscribed: true, usage: "文档协作", dueDate: iso(40), subscribedAt: iso(-50), expired: false },
    { id: "demo-8", category: "其他", plan: "iCloud+ 50GB", fee: "6", subscribed: true, usage: "云存储", dueDate: iso(25), subscribedAt: iso(-5), expired: false },
    { id: "demo-9", category: "官方", plan: "Perplexity Pro", fee: "US$20", subscribed: false, usage: "想买清单", dueDate: "", subscribedAt: "", expired: false },
    { id: "demo-10", category: "官方", plan: "Runway Standard", fee: "US$15", subscribed: true, usage: "视频生成", dueDate: iso(-40), subscribedAt: iso(-70), expired: true },
  ];
  const bills = [
    { id: "b-1", subscriptionId: "demo-1", amount: 146, paidAt: iso(-20), orderId: "OPENAI-001", note: "ChatGPT Plus 月费", kind: "payment" },
    { id: "b-2", subscriptionId: "demo-2", amount: 146, paidAt: iso(-16), orderId: "ANT-002", note: "Claude Pro 月费", kind: "payment" },
    { id: "b-3", subscriptionId: "demo-3", amount: 73, paidAt: iso(-30), orderId: "GH-003", note: "Copilot 月费", kind: "payment" },
    { id: "b-4", subscriptionId: "demo-4", amount: 49, paidAt: iso(-17), orderId: "RELAY-004", note: "中转月卡", kind: "payment" },
    { id: "b-5", subscriptionId: "demo-6", amount: 100, paidAt: iso(-9), orderId: "PACK-005", note: "额度包充值", kind: "payment" },
    { id: "b-6", subscriptionId: "demo-7", amount: 87.6, paidAt: iso(-50), orderId: "NOTION-006", note: "Notion 月费", kind: "payment" },
    { id: "b-7", subscriptionId: "demo-8", amount: 6, paidAt: iso(-5), orderId: "APPLE-007", note: "iCloud+ 月费", kind: "payment" },
    { id: "b-8", subscriptionId: "demo-5", amount: 73, paidAt: iso(-32), orderId: "MJ-008", note: "Midjourney 月费", kind: "payment" },
  ];
  return loadFromJson({ budget: 800, rows, bills });
}

function toDto(state: AppState): Dto {
  return {
    budget: state.budget,
    rows: state.rows,
    bills: state.bills,
    language: state.language,
    appearance: state.appearance,
  };
}

function fromDto(dto: Dto): AppState {
  return loadFromJson({
    budget: dto.budget,
    rows: dto.rows,
    bills: dto.bills,
    language: dto.language,
    appearance: dto.appearance,
  });
}

export async function loadAppState(): Promise<AppState> {
  if (isBrowser()) return browserDemoState();
  const dto = await invoke<Dto>("get_app_state");
  return fromDto(dto);
}

export async function persistAppState(state: AppState): Promise<void> {
  if (isBrowser()) return;
  await invoke("set_app_state", { state: toDto(state) });
}