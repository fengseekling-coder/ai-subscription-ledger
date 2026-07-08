import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<boolean>("app_lock_is_enabled").then(setAppLockEnabled);
  }, []);

  const handleToggleLock = async () => {
    if (!appLockEnabled) {
      setShowPinSetup(true);
    } else {
      await invoke("set_app_lock_enabled", { enabled: false });
      setAppLockEnabled(false);
    }
  };

  const handleSetPin = async () => {
    setError("");
    if (pin.length < 4) {
      setError("PIN 至少 4 位");
      return;
    }
    if (pin !== pinConfirm) {
      setError("两次输入不一致");
      return;
    }
    try {
      await invoke("app_lock_set_pin", { pin });
      await invoke("set_app_lock_enabled", { enabled: true });
      setAppLockEnabled(true);
      setShowPinSetup(false);
      setPin("");
      setPinConfirm("");
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal">
        <div className="modal__head">
          <h2 className="modal__title">设置</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="modal__body">
          <section className="settings-section">
            <h3 className="settings-section__title">安全</h3>

            <div className="settings-row">
              <div className="settings-row__info">
                <span className="settings-row__label">应用锁</span>
                <span className="settings-row__desc">
                  {appLockEnabled
                    ? "已开启。打开应用时需输入 PIN"
                    : "未开启。关闭后数据仍加密，但无需密码即可查看"}
              </span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={appLockEnabled}
                  onChange={handleToggleLock}
                />
                <span className="toggle__track" />
              </label>
            </div>

            {showPinSetup && (
              <div className="settings-pin-setup">
                <p className="settings-pin-setup__intro">设置 PIN 码（4 位以上）</p>
                <div className="settings-pin-setup__field">
                  <input
                    type="password"
                    placeholder="输入 PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <div className="settings-pin-setup__field">
                  <input
                    type="password"
                    placeholder="再次输入 PIN"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    maxLength={20}
                  />
                </div>
                {error && <p className="settings-pin-setup__error">{error}</p>}
                <div className="settings-pin-setup__actions">
                  <button type="button" className="primary" onClick={handleSetPin}>
                    确认
                  </button>
                  <button type="button" onClick={() => setShowPinSetup(false)}>
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="settings-info">
              <p className="settings-info__text">
                <strong>数据加密</strong>：您的所有数据使用 AES-256-GCM 加密存储在本地。
                加密密钥存储在 macOS 钥匙串中，即使设备丢失或磁盘被读取，数据也无法被解密。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
