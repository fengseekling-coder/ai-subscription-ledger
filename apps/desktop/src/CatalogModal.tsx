import {
  addRowFromCatalog,
  categoryClass,
  listCatalog,
  type AppState,
  type CatalogEntry,
  type CatalogSegment,
} from "@ai-sub/core";
import { useMemo, useState } from "react";
import { ModalCloseButton } from "./ui/Icon";

const SEGMENTS: { id: CatalogSegment | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "ai", label: "AI" },
  { id: "relay", label: "中转" },
  { id: "credit", label: "额度包" },
  { id: "dev", label: "开发" },
  { id: "design", label: "设计" },
  { id: "media", label: "影音" },
  { id: "office", label: "办公" },
  { id: "cloud", label: "云" },
];

function syncBadge(tier: CatalogEntry["syncTier"]) {
  if (tier === "paste") return <span className="catalog-badge catalog-badge--auto">可粘贴入账</span>;
  if (tier === "email") return <span className="catalog-badge">邮件（规划）</span>;
  if (tier === "oauth") return <span className="catalog-badge">API（规划）</span>;
  return null;
}

export function CatalogModal({
  state,
  onClose,
  onCommit,
}: {
  state: AppState;
  onClose: () => void;
  onCommit: (next: AppState) => void;
}) {
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<CatalogSegment | "all">("all");

  const entries = useMemo(
    () => listCatalog({ q, segment, autoFirst: true }),
    [q, segment]
  );

  const add = (id: string, subscribed: boolean) => {
    const r = addRowFromCatalog(state, id, subscribed);
    if ("error" in r) return;
    onCommit(r);
    onClose();
  };

  return (
    <div className="modal" role="dialog" aria-modal aria-labelledby="catalog-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel catalog-panel">
        <div className="modal__head">
          <h2 id="catalog-title" className="modal__title">
            服务库
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="catalog-toolbar">
          <input
            type="search"
            placeholder="搜索 ChatGPT、Cursor、中转…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="catalog-segments">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={segment === s.id ? "active" : ""}
                onClick={() => setSegment(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <p className="catalog-hint">支持自动入账的排在前面（粘贴 JSON / 订单文本）。不含日常网购与银行流水。</p>
        <ul className="catalog-list">
          {entries.map((e) => (
            <li key={e.id} className="catalog-item">
              <div className="catalog-item__main">
                <div className="catalog-item__plan">
                  {e.plan}
                  {syncBadge(e.syncTier)}
                </div>
                <div className="catalog-item__meta">
                  <span className={`category ${categoryClass(e.category)}`}>{e.category}</span>
                  <span>参考 ¥{e.feeHint}</span>
                  {(e.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className="catalog-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="catalog-item__actions">
                <button type="button" onClick={() => add(e.id, false)}>
                  加入清单
                </button>
                <button type="button" className="primary" onClick={() => add(e.id, true)}>
                  已订阅
                </button>
              </div>
            </li>
          ))}
        </ul>
        {entries.length === 0 && <p className="catalog-empty">没有匹配的服务，可用「新增订阅」自定义。</p>}
      </div>
    </div>
  );
}