import type { AppState, Monitor } from "@ai-sub/core";
import { newId } from "@ai-sub/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  catalogId: string;
  serviceId: string;
  apiKey: string;
}

interface SupportedService {
  id: string;
  label: string;
  desc: string;
  catalogIds: string[];
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function statusLabel(status: string): string {
  switch (status) {
    case "active": return "正常";
    case "expired": return "已过期";
    case "error": return "错误";
    case "unknown": return "待检查";
    default: return "未知";
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
    const svc = services.find((s) => s.id === selectedService);
    const catalogId = svc?.catalogIds?.[0] ?? selectedService;
    const newMonitor: Monitor = {
      id, catalogId, type: "api", apiKey: apiKey.trim(),
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
  }, [apiKey, selectedService, testResult, state, monitors, onCommit, services]);

  const removeMonitor = useCallback((monitorId: string) => {
    onCommit({ ...state, monitors: monitors.filter((m) => m.id !== monitorId) });
  }, [state, monitors, onCommit]);

  const refreshMonitor = useCallback(async (monitor: Monitor) => {
    setCheckingId(monitor.id);
    try {
      const result = await invoke<MonitorCheckResult>("check_monitor_cmd", {
        monitorId: monitor.id, serviceId: monitor.serviceId, apiKey: monitor.apiKey,
      });
      const updated: Monitor = {
        ...monitor, lastChecked: new Date().toISOString(),
        status: result.status as Monitor["status"],
        statusDetail: result.statusDetail, remotePlan: result.remotePlan,
        remoteAmount: result.remoteAmount, remoteRenewalDate: result.remoteRenewalDate,
        errorMessage: result.errorMessage,
      };
      onCommit({ ...state, monitors: monitors.map((m) => (m.id === monitor.id ? updated : m)) });
    } catch (e) {
      const updated: Monitor = {
        ...monitor, lastChecked: new Date().toISOString(), status: "error" as const,
        errorMessage: e instanceof Error ? e.message : String(e),
      };
      onCommit({ ...state, monitors: monitors.map((m) => (m.id === monitor.id ? updated : m)) });
    } finally {
      setCheckingId(null);
    }
  }, [state, monitors, onCommit]);

  const refreshAll = useCallback(async () => {
    if (monitors.length === 0) return;
    const inputs: MonitorInput[] = monitors.map((m) => ({
      id: m.id, catalogId: m.catalogId, serviceId: m.serviceId, apiKey: m.apiKey,
    }));
    try {
      const results = await invoke<MonitorCheckResult[]>("check_all_monitors_cmd", { monitors: inputs });
      const now = new Date().toISOString();
      const updatedMonitors = monitors.map((m) => {
        const r = results.find((x) => x.monitorId === m.id);
        if (!r) return m;
        return {
          ...m, lastChecked: now, status: r.status as Monitor["status"],
          statusDetail: r.statusDetail, remotePlan: r.remotePlan,
          remoteAmount: r.remoteAmount, remoteRenewalDate: r.remoteRenewalDate,
          errorMessage: r.errorMessage,
        };
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
          return { ...m, lastChecked: now, status: "error" as const, errorMessage: "请求失败" };
        }
        const { result } = settled.value;
        return {
          ...m, lastChecked: now, status: result.status as Monitor["status"],
          statusDetail: result.statusDetail, remotePlan: result.remotePlan,
          remoteAmount: result.remoteAmount, remoteRenewalDate: result.remoteRenewalDate,
          errorMessage: result.errorMessage,
        };
      });
      onCommit({ ...state, monitors: updatedMonitors });
    }
  }, [state, monitors, onCommit]);

  const serviceLabel = (sid: string) => services.find((s) => s.id === sid)?.label ?? sid;

  return (
    <div className="modal" role="dialog" aria-modal aria-labelledby="monitor-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel catalog-panel">
        <div className="modal__head">
          <h2 id="monitor-title" className="modal__title">自动监控</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="modal__body">
          <p className="catalog-hint" style={{ margin: "0 0 var(--space-3)" }}>
            填入 API Key，自动查询订阅状态。Key 随数据加密存储在本地。
          </p>

          {monitors.length > 0 && (
            <div className="monitor-list">
              {monitors.map((m) => (
                <div key={m.id} className="monitor-item">
                  <div className="monitor-item__info">
                    <div className="monitor-item__header">
                      <span className="monitor-item__service">{serviceLabel(m.serviceId)}</span>
                      <span className={`monitor-status ${statusClass(m.status)}`}>{statusLabel(m.status)}</span>
                    </div>
                    <div className="monitor-item__key">{maskKey(m.apiKey)}</div>
                    {m.remotePlan && <div className="monitor-item__detail">套餐: {m.remotePlan}</div>}
                    {m.remoteRenewalDate && <div className="monitor-item__detail">续费日: {m.remoteRenewalDate}</div>}
                    {m.statusDetail && <div className="monitor-item__detail">{m.statusDetail}</div>}
                    {m.errorMessage && <div className="monitor-item__error">{m.errorMessage}</div>}
                    <div className="monitor-item__meta">
                      {m.lastChecked ? `上次检查: ${new Date(m.lastChecked).toLocaleString("zh-CN")}` : "尚未检查"}
                    </div>
                  </div>
                  <div className="monitor-item__actions">
                    <button type="button" className="btn btn--sm" disabled={checkingId === m.id} onClick={() => refreshMonitor(m)}>
                      {checkingId === m.id ? "检查中…" : "刷新"}
                    </button>
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => removeMonitor(m.id)}>删除</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn--sm" style={{ alignSelf: "flex-start", marginTop: "var(--space-2)" }} onClick={refreshAll}>
                全部刷新
              </button>
            </div>
          )}

          {adding ? (
            <div className="monitor-add">
              <div className="form-field">
                <label>服务</label>
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
                  {testResult.status === "error" ? `验证失败: ${testResult.errorMessage}` : `验证通过 — ${testResult.statusDetail || "API Key 有效"}`}
                </div>
              )}
              <div className="modal__foot-actions">
                <button type="button" className="btn btn--ghost" onClick={() => { setAdding(false); setApiKey(""); setTestResult(null); }}>取消</button>
                <button type="button" className="btn" disabled={testing || !apiKey.trim()} onClick={testConnection}>{testing ? "验证中…" : "测试连接"}</button>
                <button type="button" className="primary" disabled={!testResult || testResult.status === "error"} onClick={confirmAdd}>添加</button>
              </div>
            </div>
          ) : (
            <button type="button" className="primary" onClick={() => setAdding(true)} style={{ marginTop: monitors.length > 0 ? "var(--space-3)" : 0 }}>
              添加监控
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
