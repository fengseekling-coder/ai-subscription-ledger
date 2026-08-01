import type { AppState, Monitor } from "@ai-sub/core";
import { newId } from "@ai-sub/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveLang, tFor, type Dict } from "./i18n";
import { invoke } from "@tauri-apps/api/core";
import { ModalCloseButton } from "./ui/Icon";

interface MonitorCheckResult {
  monitorId: string;
  status: string;
  statusDetail: string;
  remotePlan: string;
  remoteAmount: number;
  remoteRenewalDate: string;
  errorMessage: string;
}

interface MonitorInput {
  id: string;
  serviceId: string;
  apiKey: string;
}

interface SupportedService {
  id: string;
  label: string;
  desc: string;
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

/** status 是后端返回的数据值，只有展示文案本地化。 */
function statusLabel(status: string, t: Dict["monitor"]): string {
  switch (status) {
    case "active": return t.statusActive;
    case "expired": return t.statusExpired;
    case "error": return t.statusError;
    case "unknown": return t.statusUnknown;
    default: return t.statusOther;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "active": return "monitor-status--ok";
    case "expired": return "monitor-status--warn";
    case "error": return "monitor-status--danger";
    case "unknown": return "monitor-status--muted";
    default: return "";
  }
}

interface Props {
  state: AppState;
  onClose: () => void;
  onCommit: (next: AppState) => void;
}

export function MonitorModal({ state, onClose, onCommit }: Props) {
  const lang = resolveLang(state.language);
  const t = tFor(lang).monitor;
  // useMemo：`?? []` 每次渲染都会新建数组，会让所有依赖 monitors 的 useCallback 失效。
  const monitors = useMemo(() => state.monitors ?? [], [state.monitors]);
  const [services, setServices] = useState<SupportedService[]>([]);
  const [adding, setAdding] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<MonitorCheckResult | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 服务列表到手时顺带选中第一项，不再用第二个 effect 追着 services 改 state。
  useEffect(() => {
    invoke<SupportedService[]>("get_supported_services")
      .then((list) => {
        setServices(list);
        setSelectedService((prev) => prev || list[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 100);
  }, [adding]);

  const testConnection = useCallback(async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<MonitorCheckResult>("check_monitor_cmd", {
        monitorId: "test",
        serviceId: selectedService,
        apiKey: apiKey.trim(),
      });
      setTestResult(result);
    } catch (e) {
      setTestResult({
        monitorId: "test", status: "error", statusDetail: "",
        remotePlan: "", remoteAmount: 0, remoteRenewalDate: "",
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  }, [apiKey, selectedService]);

  const confirmAdd = useCallback(() => {
    if (!apiKey.trim() || !testResult || testResult.status === "error") return;
    const id = newId();
    const newMonitor: Monitor = {
      id, type: "api", apiKey: apiKey.trim(),
      serviceId: selectedService, lastChecked: new Date().toISOString(),
      status: testResult.status as Monitor["status"],
      statusDetail: testResult.statusDetail, remotePlan: testResult.remotePlan,
      remoteAmount: testResult.remoteAmount,
      remoteRenewalDate: testResult.remoteRenewalDate,
      errorMessage: testResult.errorMessage,
    };
    onCommit({ ...state, monitors: [...monitors, newMonitor] });
    setAdding(false);
    setApiKey("");
    setTestResult(null);
  }, [apiKey, selectedService, testResult, state, monitors, onCommit]);

  const removeMonitor = useCallback((monitorId: string) => {
    onCommit({ ...state, monitors: monitors.filter((m) => m.id !== monitorId) });
  }, [state, monitors, onCommit]);

  /** 从 result → updated Monitor */
  const updateMonitorFromResult = (monitor: Monitor, result: MonitorCheckResult, now: string): Monitor => ({
    ...monitor,
    lastChecked: now,
    status: result.status as Monitor["status"],
    statusDetail: result.statusDetail,
    remotePlan: result.remotePlan,
    remoteAmount: result.remoteAmount,
    remoteRenewalDate: result.remoteRenewalDate,
    errorMessage: result.errorMessage,
  });

  /** 更新单个 monitor，错误处理统一返回带错误状态的 Monitor */
  const updateMonitorOnError = (monitor: Monitor, e: unknown, now: string): Monitor => ({
    ...monitor,
    lastChecked: now,
    status: "error" as const,
    errorMessage: e instanceof Error ? e.message : String(e),
  });

  const refreshMonitor = useCallback(async (monitor: Monitor) => {
    setCheckingId(monitor.id);
    try {
      const result = await invoke<MonitorCheckResult>("check_monitor_cmd", {
        monitorId: monitor.id, serviceId: monitor.serviceId, apiKey: monitor.apiKey,
      });
      const updated = updateMonitorFromResult(monitor, result, new Date().toISOString());
      onCommit({ ...state, monitors: monitors.map((m) => (m.id === monitor.id ? updated : m)) });
    } catch (e) {
      const updated = updateMonitorOnError(monitor, e, new Date().toISOString());
      onCommit({ ...state, monitors: monitors.map((m) => (m.id === monitor.id ? updated : m)) });
    } finally {
      setCheckingId(null);
    }
  }, [state, monitors, onCommit]);

  const refreshAll = useCallback(async () => {
    if (monitors.length === 0) return;
    const inputs: MonitorInput[] = monitors.map((m) => ({
      id: m.id, serviceId: m.serviceId, apiKey: m.apiKey,
    }));
    try {
      const results = await invoke<MonitorCheckResult[]>("check_all_monitors_cmd", { monitors: inputs });
      const now = new Date().toISOString();
      const updatedMonitors = monitors.map((m) => {
        const r = results.find((x) => x.monitorId === m.id);
        if (!r) return m;
        return updateMonitorFromResult(m, r, now);
      });
      onCommit({ ...state, monitors: updatedMonitors });
    } catch {
      const results = await Promise.allSettled(
        monitors.map(async (m) => {
          const result = await invoke<MonitorCheckResult>("check_monitor_cmd", {
            monitorId: m.id, serviceId: m.serviceId, apiKey: m.apiKey,
          });
          return { monitor: m, result };
        })
      );
      const now = new Date().toISOString();
      const updatedMonitors = monitors.map((m) => {
        const settled = results.find(
          (r): r is PromiseFulfilledResult<{ monitor: Monitor; result: MonitorCheckResult }> =>
            r.status === "fulfilled" && r.value.monitor.id === m.id
        );
        if (!settled) {
          // 不本地化：errorMessage 是会被持久化的数据，且同一字段的其他取值来自
          // Rust 后端（本身就是中文），只翻这一个 JS 兜底反而不一致。
          return updateMonitorOnError(m, Error("请求失败"), now);
        }
        const { result } = settled.value;
        return updateMonitorFromResult(m, result, now);
      });
      onCommit({ ...state, monitors: updatedMonitors });
    }
  }, [state, monitors, onCommit]);

  const serviceLabel = (sid: string) => services.find((s) => s.id === sid)?.label ?? sid;

  return (
    <div className="modal" role="dialog" aria-modal aria-labelledby="monitor-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel modal__panel--wide">
        <div className="modal__head">
          <h2 id="monitor-title" className="modal__title">{t.title}</h2>
          <ModalCloseButton onClick={onClose} label={tFor(lang).common.close} />
        </div>
        <div className="modal__body">
          <p className="modal-description">{t.desc}</p>

          {monitors.length > 0 && (
            <div className="monitor-list">
              {monitors.map((m) => (
                <div key={m.id} className="monitor-item">
                  <div className="monitor-item__info">
                    <div className="monitor-item__header">
                      <span className="monitor-item__service">{serviceLabel(m.serviceId)}</span>
                      <span className={`monitor-status ${statusClass(m.status)}`}>{statusLabel(m.status, t)}</span>
                    </div>
                    <div className="monitor-item__key">{maskKey(m.apiKey)}</div>
                    {m.remotePlan && <div className="monitor-item__detail">{t.planLabel(m.remotePlan)}</div>}
                    {m.remoteRenewalDate && <div className="monitor-item__detail">{t.dueLabel(m.remoteRenewalDate)}</div>}
                    {m.statusDetail && <div className="monitor-item__detail">{m.statusDetail}</div>}
                    {m.errorMessage && <div className="monitor-item__error">{m.errorMessage}</div>}
                    <div className="monitor-item__meta">
                      {m.lastChecked ? t.lastChecked(new Date(m.lastChecked).toLocaleString(lang)) : t.notChecked}
                    </div>
                  </div>
                  <div className="monitor-item__actions">
                    <button type="button" className="btn btn--sm" disabled={checkingId === m.id} onClick={() => refreshMonitor(m)}>
                      {checkingId === m.id ? t.checking : t.refresh}
                    </button>
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => removeMonitor(m.id)}>{t.remove}</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn--sm" style={{ alignSelf: "flex-start", marginTop: "var(--space-2)" }} onClick={refreshAll}>
                {t.refreshAll}
              </button>
            </div>
          )}

          {adding ? (
            <div className="monitor-add">
              <div className="form-field">
                <label>{t.service}</label>
                <select className="select" value={selectedService} onChange={(e) => { setSelectedService(e.target.value); setTestResult(null); }}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.label} — {s.desc}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>API Key</label>
                <input ref={inputRef} className="input" type="password" placeholder="sk-..." value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && apiKey.trim() && !testing) void testConnection(); }}
                />
              </div>
              {testResult && (
                <div className={"modal-notice" + (testResult.status === "error" ? " danger" : "")}>
                  {testResult.status === "error"
                    ? t.verifyFailed(testResult.errorMessage)
                    : t.verifyOk(testResult.statusDetail || t.keyValid)}
                </div>
              )}
              <div className="modal__foot-actions">
                <button type="button" className="btn btn--ghost" onClick={() => { setAdding(false); setApiKey(""); setTestResult(null); }}>{t.cancel}</button>
                <button type="button" className="btn" disabled={testing || !apiKey.trim()} onClick={testConnection}>{testing ? t.testing : t.testConnection}</button>
                <button type="button" className="primary" disabled={!testResult || testResult.status === "error"} onClick={confirmAdd}>{t.add}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="primary" onClick={() => setAdding(true)} style={{ marginTop: monitors.length > 0 ? "var(--space-3)" : 0 }}>
              {t.addMonitor}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
