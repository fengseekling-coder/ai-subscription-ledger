import {
  addRowFromCatalog,
  categoryClass,
  listCatalog,
  type AppState,
  type CatalogEntry,
  type CatalogSegment,
} from "@ai-sub/core";
import { useMemo, useState } from "react";
import { categoryLabel } from "./categoryLabel";
import { resolveLang, tFor, type Dict } from "./i18n";
import { ModalCloseButton } from "./ui/Icon";

/** id 是筛选用的数据键，label 走字典。 */
const SEGMENTS: { id: CatalogSegment | "all"; label: (t: Dict["catalog"]) => string }[] = [
  { id: "all", label: (t) => t.segAll },
  { id: "ai", label: () => "AI" },
  { id: "relay", label: (t) => t.segRelay },
  { id: "credit", label: (t) => t.segCredit },
  { id: "dev", label: (t) => t.segDev },
  { id: "design", label: (t) => t.segDesign },
  { id: "media", label: (t) => t.segMedia },
  { id: "office", label: (t) => t.segOffice },
  { id: "cloud", label: (t) => t.segCloud },
];

function syncBadge(tier: CatalogEntry["syncTier"], t: Dict["catalog"]) {
  if (tier === "paste") return <span className="catalog-badge catalog-badge--auto">{t.badgePaste}</span>;
  if (tier === "email") return <span className="catalog-badge">{t.badgeEmail}</span>;
  if (tier === "oauth") return <span className="catalog-badge catalog-badge--monitor">{t.badgeOauth}</span>;
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
  const dict = tFor(resolveLang(state.language));
  const t = dict.catalog;
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
            {t.title}
          </h2>
          <ModalCloseButton onClick={onClose} label={dict.common.close} />
        </div>
        <div className="catalog-toolbar">
          <input
            type="search"
            placeholder={t.searchPlaceholder}
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
                {s.label(t)}
              </button>
            ))}
          </div>
        </div>
        <p className="catalog-hint">{t.hint}</p>
        <ul className="catalog-list">
          {entries.map((e) => (
            <li key={e.id} className="catalog-item">
              <div className="catalog-item__main">
                <div className="catalog-item__plan">
                  {e.plan}
                  {syncBadge(e.syncTier, t)}
                </div>
                <div className="catalog-item__meta">
                  <span className={`category ${categoryClass(e.category)}`}>{categoryLabel(e.category, dict.table)}</span>
                  <span>{t.feeHint(String(e.feeHint))}</span>
                  {(e.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className="catalog-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="catalog-item__actions">
                <button type="button" onClick={() => add(e.id, false)}>
                  {t.addToWishlist}
                </button>
                <button type="button" className="primary" onClick={() => add(e.id, true)}>
                  {t.alreadySubscribed}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {entries.length === 0 && <p className="catalog-empty">{t.empty}</p>}
      </div>
    </div>
  );
}