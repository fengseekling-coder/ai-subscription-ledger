import type { SubscriptionRow } from "./types.js";

export const defaultRowsSeed: Omit<SubscriptionRow, "id">[] = [
  {
    category: "示例",
    plan: "示例月费工具 A",
    fee: "20",
    subscribed: true,
    usage: "订单 SAMPLE0001 · 2026-07-05",
    dueDate: "2026-07-08",
    subscribedAt: "",
    expired: false,
  },
  {
    category: "示例",
    plan: "示例年费服务 B",
    fee: "99",
    subscribed: true,
    usage: "",
    dueDate: "2026-08-15",
    subscribedAt: "",
    expired: false,
  },
  { category: "示例", plan: "示例额度包 C", fee: "50", subscribed: false, usage: "", dueDate: "", subscribedAt: "", expired: false },
];
