interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  return (
    <div className="settings-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-modal__head">
          <h2 className="settings-modal__title">设置</h2>
          <button type="button" className="settings-modal__close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="settings-modal__body">
          <section className="settings-section">
            <h3 className="settings-section__title">安全</h3>

            <div className="settings-info">
              <p className="settings-info__text">
                <strong>数据加密</strong>：您的所有数据使用 AES-256-GCM 加密存储在本地。
                加密密钥保存在本地的 <code>.ledger_key</code> 文件（<code>chmod 0o600</code>），
                不写入 macOS 钥匙串，避免每次启动弹出系统授权框。
              </p>
              <p className="settings-info__text" style={{ marginTop: 12 }}>
                打开应用无需输入 PIN。设备丢失且知道登录密码的情况下，
                拥有 root 权限或物理磁盘提取的人可能读取数据。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
