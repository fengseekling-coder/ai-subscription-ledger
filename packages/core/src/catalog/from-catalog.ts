import { normalizeRow } from "../normalize.js";
import type { SubscriptionRow } from "../types.js";
import type { CatalogEntry } from "./types.js";
import { getCatalogEntry } from "./entries.js";

export function rowFromCatalog(entry: CatalogEntry, subscribed = false): SubscriptionRow {
  return normalizeRow({
    category: entry.category,
    plan: entry.plan,
    fee: entry.feeHint,
    subscribed,
    dueDate: "",
    usage: entry.syncTier === "paste" ? "可从「粘贴同步」导入账单" : "",
    segment: entry.segment,
    subscribeUrl: entry.subscribeUrl,
    portalUrl: entry.portalUrl,
  });
}

export function rowFromCatalogId(id: string, subscribed = false): SubscriptionRow | null {
  const entry = getCatalogEntry(id);
  if (!entry) return null;
  return rowFromCatalog(entry, subscribed);
}