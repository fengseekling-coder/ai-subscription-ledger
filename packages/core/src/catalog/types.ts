/** 规范化分段，用于筛选与图标 */
export type CatalogSegment =
  | "ai"
  | "relay"
  | "credit"
  | "dev"
  | "design"
  | "media"
  | "office"
  | "cloud"
  | "other";

/** 自动入账能力（诚实分级，见 product-mvp §5.3） */
export type SyncTier =
  | "none" // 仅预填卡片
  | "paste" // 粘贴 JSON / 面板导出
  | "email" // 规划：订阅类邮件解析
  | "oauth"; // 规划：官方 API

export interface CatalogEntry {
  id: string;
  /** 写入 row.category 的展示文案 */
  category: string;
  segment: CatalogSegment;
  plan: string;
  /** 建议月费展示，用户可改 */
  feeHint: string;
  /** 是否周期订阅（false → 额度包类） */
  recurring: boolean;
  syncTier: SyncTier;
  /** paste 连接器 id，见 connectors.ts */
  connectorId?: string;
  subscribeUrl?: string;
  portalUrl?: string;
  tags?: string[];
  /** 排序：越小越靠前（自动入账优先） */
  rank: number;
}

export interface ConnectorPasteResult {
  rows?: Partial<import("../types.js").SubscriptionRow>[];
  bills?: Partial<import("../types.js").Bill>[];
  note?: string;
}