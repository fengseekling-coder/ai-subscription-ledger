use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;
use thiserror::Error;

const KEY_STATE: &str = "ai-subscription-tracker-v3";
const KEY_FILE: &str = ".ledger_key";
// Magic prefix for all new encrypted writes. Unambiguously distinguishes encrypted
// format (always starts with this prefix) from legacy unencrypted JSON (never has it).
// Length = 12 bytes, matching the AES-GCM nonce size.
const ENCRYPTED_MAGIC: &[u8] = b"SUBLEDGER_V1";

// ── Why no Keychain / stronghold / Windows DPAPI ─────────────────────────────
// The previous design stored the AES key in the macOS Keychain via
// security-framework. That caused the OS to prompt for permission every time
// the key was read (each app launch), which most users found unacceptable for a
// single-device local app. We deliberately keep the key in a 0o600 file on disk
// so the app starts silently. Do NOT add Keychain / stronghold / DPAPI back
// without revisiting this trade-off and adding a user-facing opt-in.

#[derive(Debug, Error)]
pub enum DbError {
    #[error("{0}")]
    Msg(String),
    /// 账本已加密，但密钥文件不在。这是**可恢复**状态：用户把 `.ledger_key`
    /// 放回数据目录即可正常读取，所以这条路径绝不能改名/覆盖 ledger.db。
    #[error("账本已加密，但密钥文件 .ledger_key 缺失，无法解密。请从备份中恢复该文件到应用数据目录后重启。数据文件未被改动。")]
    KeyMissing,
}

impl From<rusqlite::Error> for DbError {
    fn from(e: rusqlite::Error) -> Self {
        DbError::Msg(e.to_string())
    }
}

impl From<serde_json::Error> for DbError {
    fn from(e: serde_json::Error) -> Self {
        DbError::Msg(e.to_string())
    }
}

impl From<aes_gcm::Error> for DbError {
    fn from(e: aes_gcm::Error) -> Self {
        DbError::Msg(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStateDto {
    pub budget: f64,
    pub rows: Vec<serde_json::Value>,
    pub bills: Vec<serde_json::Value>,
    #[serde(default)]
    pub monitors: Vec<serde_json::Value>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub appearance: Option<serde_json::Value>,
}

fn default_state() -> AppStateDto {
    AppStateDto {
        budget: 500.0,
        rows: vec![],
        bills: vec![],
        monitors: vec![],
        language: None,
        appearance: None,
    }
}

// ── Local key file (no Keychain prompts) ─────────────────────────────────────

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, DbError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DbError::Msg(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(|e| DbError::Msg(e.to_string()))?;
    Ok(dir)
}

fn key_path(dir: &Path) -> PathBuf {
    dir.join(KEY_FILE)
}

fn read_key_file(path: &Path) -> Result<[u8; 32], DbError> {
    let bytes = std::fs::read(path).map_err(|e| DbError::Msg(e.to_string()))?;
    if bytes.len() != 32 {
        return Err(DbError::Msg(format!(
            "Key file has unexpected length {} (expected 32)",
            bytes.len()
        )));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

fn write_key_file(path: &Path, key: &[u8; 32]) -> Result<(), DbError> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| DbError::Msg(e.to_string()))?;
        file.write_all(key)
            .map_err(|e| DbError::Msg(e.to_string()))?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, key).map_err(|e| DbError::Msg(e.to_string()))?;
        // Windows：AppData 默认仅当前用户可访问，但显式移除继承 ACL 并仅授予当前用户，
        // 等价于 unix 的 0o600（文件仅属主可读写）。icacls 不可用时静默忽略——目录隔离已提供保护。
        if let Ok(user) = std::env::var("USERNAME") {
            let _ = std::process::Command::new("icacls")
                .arg(path)
                .arg("/inheritance:r")
                .arg("/grant:r")
                .arg(format!("{}:(F)", user))
                .status();
        }
        Ok(())
    }
}

/// **写路径专用**：首次运行时生成密钥。只有正在产生新密文的调用方可以用它。
fn get_or_create_key_in(dir: &Path) -> Result<[u8; 32], DbError> {
    let path = key_path(dir);

    if path.exists() {
        return read_key_file(&path);
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    write_key_file(&path, &key)?;
    Ok(key)
}

/// **读路径专用**：密钥必须已存在，缺失时报 `KeyMissing` 而不是新造一把。
///
/// 解密时绝不能调 `get_or_create_key_in`：那样会在密钥丢失时铸造一把新钥，
/// 解密随即必然失败，于是「密钥文件丢了」被误判成「数据损坏」——用户的
/// ledger.db 会被改名归档，而真正的原因（旧密钥）已被新密钥覆盖掉。
fn require_key_in(dir: &Path) -> Result<[u8; 32], DbError> {
    let path = key_path(dir);

    if !path.exists() {
        return Err(DbError::KeyMissing);
    }
    read_key_file(&path)
}

// ── Encryption helpers ────────────────────────────────────────────────────────

fn encrypt_with(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, DbError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| DbError::Msg(format!("Cipher init error: {}", e)))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| DbError::Msg(format!("Encryption error: {}", e)))?;

    let mut result = ENCRYPTED_MAGIC.to_vec();
    result.extend_from_slice(&nonce_bytes);
    result.extend(ciphertext);
    Ok(result)
}

fn decrypt_with(key: &[u8; 32], encrypted: &[u8]) -> Result<Vec<u8>, DbError> {
    // MAGIC(12) + nonce(12) + GCM tag(16) = 40，短于此不可能是合法密文。
    if encrypted.len() < 40 {
        return Err(DbError::Msg("Encrypted data too short".to_string()));
    }

    let data = &encrypted[ENCRYPTED_MAGIC.len()..];
    let nonce = Nonce::from_slice(&data[..12]);
    let ciphertext = &data[12..];

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| DbError::Msg(format!("Cipher init error: {}", e)))?;

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| DbError::Msg(format!("Decryption error: {}", e)))
}

// ── Database operations ───────────────────────────────────────────────────────

/// 数据目录下的账本文件名。`load_state_in` / `save_state_in` 都以它拼路径。
const DB_FILE: &str = "ledger.db";

fn open(path: &Path) -> Result<Connection, DbError> {
    let conn = Connection::open(path)?;
    let schema: Result<String, _> = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE name = 'kv' AND type = 'table'",
        [],
        |row| row.get(0),
    );
    match schema {
        Ok(s) if s.contains("TEXT NOT NULL") && !s.contains("BLOB") => {
            conn.execute_batch(
                "ALTER TABLE kv RENAME TO kv_old;
                 CREATE TABLE kv (key TEXT PRIMARY KEY, value BLOB NOT NULL);
                 INSERT INTO kv SELECT key, value FROM kv_old;
                 DROP TABLE kv_old;",
            )?;
        }
        _ => {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS kv (
                    key TEXT PRIMARY KEY,
                    value BLOB NOT NULL
                );",
            )?;
        }
    }
    Ok(conn)
}

/// 把读不出来的 ledger.db 归档，返回实际使用的文件名。
///
/// 文件名带时间戳，且在同秒内重名时追加序号：固定名（如 `ledger.db.unreadable`）
/// 会让第二次归档覆盖掉第一次的，而那可能是用户仅存的一份旧数据。
fn backup_unreadable_db(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    // 时间戳只到秒，同一秒内连续失败会撞名，所以再往后找一个没被占用的序号。
    let mut backup = path.with_extension(format!("db.unreadable-{}", stamp));
    let mut n = 2;
    while backup.exists() && n < 100 {
        backup = path.with_extension(format!("db.unreadable-{}-{}", stamp, n));
        n += 1;
    }
    match std::fs::rename(path, &backup) {
        Ok(()) => backup
            .file_name()
            .map(|name| name.to_string_lossy().into_owned()),
        Err(e) => {
            eprintln!("[db] failed to archive unreadable ledger.db: {}", e);
            None
        }
    }
}

fn parse_raw_data_in(dir: &Path, data: &[u8]) -> Result<AppStateDto, DbError> {
    if data.starts_with(ENCRYPTED_MAGIC) {
        let key = require_key_in(dir)?;
        let decrypted = decrypt_with(&key, data)?;
        let json_str = String::from_utf8(decrypted)
            .map_err(|e| DbError::Msg(format!("UTF-8 decode error: {}", e)))?;
        return Ok(serde_json::from_str(&json_str)?);
    }

    // 旧版明文 JSON：没有魔术前缀，不需要密钥也能读（一次性迁移，写回时会加密）。
    let json_str = String::from_utf8(data.to_vec())
        .map_err(|e| DbError::Msg(format!("UTF-8 decode error: {}", e)))?;
    Ok(serde_json::from_str(&json_str)?)
}

/// 数据目录版的读取。`load_state` 只是它加一层 `AppHandle` → 目录的转换，
/// 业务逻辑都在这里，便于测试。
pub fn load_state_in(dir: &Path) -> Result<AppStateDto, DbError> {
    let path = dir.join(DB_FILE);

    if !path.exists() {
        return Ok(default_state());
    }

    let conn = open(&path)?;
    let raw: Option<Vec<u8>> = conn
        .query_row(
            "SELECT value FROM kv WHERE key = ?1",
            params![KEY_STATE],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .ok()
        .or_else(|| {
            conn.query_row(
                "SELECT value FROM kv WHERE key = ?1",
                params![KEY_STATE],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .map(|s| s.into_bytes())
        });

    match raw {
        Some(data) => match parse_raw_data_in(dir, &data) {
            Ok(state) => Ok(state),
            // 密钥文件缺失：可恢复，原封不动地把 ledger.db 留在原地并报错。
            // 若在这里归档，用户下次启动会看到「空账本 + 无报错」，随后第一次
            // 编辑就会把空状态写回，旧账本从此只存在于归档文件里。
            Err(DbError::KeyMissing) => {
                eprintln!("[db] load_state: .ledger_key missing; ledger.db left untouched");
                Err(DbError::KeyMissing)
            }
            Err(e) => {
                // 密钥在，但解不开或解出来不是合法 JSON——数据确实损坏了
                // （或出自旧的加密方案）。归档后把原因报给 UI，避免用户看到
                // 一个空账本、以为什么都没发生过。
                eprintln!("[db] load_state failed; archiving ledger.db. cause: {}", e);
                drop(conn);
                let archived = backup_unreadable_db(&path);
                Err(DbError::Msg(match archived {
                    Some(name) => {
                        format!("数据文件存在但无法读取（{}）。原文件已归档为 {}。", e, name)
                    }
                    None => format!(
                        "数据文件存在但无法读取（{}）。归档失败，原文件仍在原处。",
                        e
                    ),
                }))
            }
        },
        None => Ok(default_state()),
    }
}

/// 数据目录版的写入。见 `load_state_in` 的说明。
pub fn save_state_in(dir: &Path, state: &AppStateDto) -> Result<(), DbError> {
    let path = dir.join(DB_FILE);
    let mut conn = open(&path)?;

    let json = serde_json::to_string(state)?;
    let key = get_or_create_key_in(dir)?;
    let encrypted = encrypt_with(&key, json.as_bytes())?;

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![KEY_STATE, encrypted],
    )?;
    tx.commit()?;
    Ok(())
}

// ── AppHandle 包装层 ──────────────────────────────────────────────────────────
// 这两个只做「AppHandle → 数据目录」的转换，逻辑全在 *_in 版本里。

pub fn load_state(app: &tauri::AppHandle) -> Result<AppStateDto, DbError> {
    load_state_in(&app_data_dir(app)?)
}

pub fn save_state(app: &tauri::AppHandle, state: &AppStateDto) -> Result<(), DbError> {
    save_state_in(&app_data_dir(app)?, state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_state() -> AppStateDto {
        AppStateDto {
            budget: 800.0,
            rows: vec![serde_json::json!({ "id": "r1", "plan": "Claude Pro", "fee": "US$20" })],
            bills: vec![serde_json::json!({ "id": "b1", "subscriptionId": "r1", "amount": 144.0 })],
            monitors: vec![
                serde_json::json!({ "id": "m1", "serviceId": "anthropic", "apiKey": "sk-secret" }),
            ],
            language: Some("zh-CN".into()),
            appearance: Some(serde_json::json!({ "mode": "dark" })),
        }
    }

    fn archives_in(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.contains("unreadable"))
            .collect();
        names.sort();
        names
    }

    #[test]
    fn missing_db_yields_default_state() {
        let dir = TempDir::new().unwrap();
        let state = load_state_in(dir.path()).unwrap();
        assert_eq!(state.budget, 500.0);
        assert!(state.rows.is_empty());
    }

    #[test]
    fn save_then_load_round_trips_every_field() {
        let dir = TempDir::new().unwrap();
        save_state_in(dir.path(), &sample_state()).unwrap();

        let loaded = load_state_in(dir.path()).unwrap();
        assert_eq!(loaded.budget, 800.0);
        assert_eq!(loaded.rows.len(), 1);
        assert_eq!(loaded.bills.len(), 1);
        assert_eq!(loaded.monitors.len(), 1);
        assert_eq!(loaded.language.as_deref(), Some("zh-CN"));
        assert!(loaded.appearance.is_some());
    }

    #[test]
    fn written_ledger_is_encrypted_on_disk() {
        let dir = TempDir::new().unwrap();
        save_state_in(dir.path(), &sample_state()).unwrap();

        // 整包落盘必须是密文：明文会把 monitors[].apiKey 直接暴露在文件里。
        let raw = std::fs::read(dir.path().join(DB_FILE)).unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("sk-secret"));
        assert!(dir.path().join(KEY_FILE).exists());
    }

    /// P0 回归：密钥文件缺失时必须报 `KeyMissing`，**且不得动 ledger.db**。
    ///
    /// 旧行为是读路径调 `get_or_create_key` 现造一把新钥 → 解密必然失败 → 账本被
    /// 归档改名 → 下次启动看到空账本、无报错 → 首次编辑把空状态写回，旧账本只剩归档。
    #[test]
    fn missing_key_reports_key_missing_and_leaves_db_untouched() {
        let dir = TempDir::new().unwrap();
        save_state_in(dir.path(), &sample_state()).unwrap();

        let db = dir.path().join(DB_FILE);
        let before = std::fs::read(&db).unwrap();
        std::fs::remove_file(dir.path().join(KEY_FILE)).unwrap();

        let err = load_state_in(dir.path()).unwrap_err();
        assert!(matches!(err, DbError::KeyMissing), "got {:?}", err);

        // 账本原地未动，字节一致
        assert!(db.exists(), "ledger.db 不应被改名");
        assert_eq!(std::fs::read(&db).unwrap(), before);
        assert!(archives_in(dir.path()).is_empty(), "不应产生归档文件");
        // 也不该顺手补一把新密钥出来
        assert!(!dir.path().join(KEY_FILE).exists(), "读路径不应生成新密钥");
    }

    /// 把密钥放回去就能恢复 —— 这正是上面那条「不许改名」的意义。
    #[test]
    fn restoring_the_key_recovers_the_ledger() {
        let dir = TempDir::new().unwrap();
        save_state_in(dir.path(), &sample_state()).unwrap();

        let key_file = dir.path().join(KEY_FILE);
        let saved_key = std::fs::read(&key_file).unwrap();
        std::fs::remove_file(&key_file).unwrap();
        assert!(load_state_in(dir.path()).is_err());

        std::fs::write(&key_file, &saved_key).unwrap();
        assert_eq!(load_state_in(dir.path()).unwrap().budget, 800.0);
    }

    #[test]
    fn wrong_key_archives_the_db_and_is_not_key_missing() {
        let dir = TempDir::new().unwrap();
        save_state_in(dir.path(), &sample_state()).unwrap();

        // 密钥存在但不匹配（例如从别处恢复了一把错的钥匙）
        std::fs::write(dir.path().join(KEY_FILE), [7u8; 32]).unwrap();

        let err = load_state_in(dir.path()).unwrap_err();
        assert!(!matches!(err, DbError::KeyMissing));
        let msg = err.to_string();
        assert!(
            msg.contains("已归档为"),
            "错误信息应给出归档文件名：{}",
            msg
        );
        assert!(!dir.path().join(DB_FILE).exists());
        assert_eq!(archives_in(dir.path()).len(), 1);
    }

    /// 回归：归档文件名固定时，第二次失败会覆盖第一次的归档（可能是仅存的旧数据）。
    #[test]
    fn repeated_failures_keep_every_archive() {
        let dir = TempDir::new().unwrap();

        for i in 0..3u8 {
            // 每轮先用 [i;32] 加密，再把密钥换成另一把，确保这一轮的密文真解不开。
            // （若两轮都用同一把「坏」钥匙，第二轮的 save 会用它加密，反而能解开。）
            std::fs::write(dir.path().join(KEY_FILE), [i; 32]).unwrap();
            save_state_in(dir.path(), &sample_state()).unwrap();
            std::fs::write(dir.path().join(KEY_FILE), [i + 100; 32]).unwrap();
            assert!(load_state_in(dir.path()).is_err(), "第 {} 轮应解密失败", i);
        }

        // 三次连续失败（同一秒内）必须留下三份互不覆盖的归档
        assert_eq!(
            archives_in(dir.path()).len(),
            3,
            "{:?}",
            archives_in(dir.path())
        );
    }

    #[test]
    fn legacy_plaintext_json_loads_without_a_key() {
        let dir = TempDir::new().unwrap();
        let db = dir.path().join(DB_FILE);
        let conn = open(&db).unwrap();
        conn.execute(
            "INSERT INTO kv (key, value) VALUES (?1, ?2)",
            params![
                KEY_STATE,
                br#"{"budget":123,"rows":[],"bills":[]}"#.to_vec()
            ],
        )
        .unwrap();
        drop(conn);

        // 旧版明文没有魔术前缀，不需要密钥
        assert!(!dir.path().join(KEY_FILE).exists());
        assert_eq!(load_state_in(dir.path()).unwrap().budget, 123.0);
    }

    #[test]
    fn encrypt_round_trips_and_rejects_a_wrong_key() {
        let key = [1u8; 32];
        let blob = encrypt_with(&key, b"ledger").unwrap();

        assert!(blob.starts_with(ENCRYPTED_MAGIC));
        assert_eq!(decrypt_with(&key, &blob).unwrap(), b"ledger");
        assert!(decrypt_with(&[2u8; 32], &blob).is_err());
    }

    #[test]
    fn encrypt_uses_a_fresh_nonce_each_time() {
        let key = [1u8; 32];
        let a = encrypt_with(&key, b"same input").unwrap();
        let b = encrypt_with(&key, b"same input").unwrap();
        assert_ne!(a, b, "nonce 必须每次随机，否则相同明文产生相同密文");
    }

    #[test]
    fn decrypt_rejects_truncated_input() {
        assert!(decrypt_with(&[1u8; 32], b"short").is_err());
    }

    #[test]
    fn key_file_length_is_validated() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join(KEY_FILE);
        std::fs::write(&path, [0u8; 16]).unwrap();
        assert!(read_key_file(&path).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn key_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let dir = TempDir::new().unwrap();
        let key = get_or_create_key_in(dir.path()).unwrap();
        assert_eq!(key.len(), 32);

        let mode = std::fs::metadata(dir.path().join(KEY_FILE))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600, "密钥文件必须仅属主可读写");
    }

    #[test]
    fn get_or_create_key_is_stable_across_calls() {
        let dir = TempDir::new().unwrap();
        let first = get_or_create_key_in(dir.path()).unwrap();
        let second = get_or_create_key_in(dir.path()).unwrap();
        assert_eq!(first, second, "已存在的密钥不能被覆盖");
    }
}
