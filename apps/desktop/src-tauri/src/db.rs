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
}

fn default_state() -> AppStateDto {
    AppStateDto {
        budget: 500.0,
        rows: vec![],
        bills: vec![],
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
        Ok(())
    }
}

fn get_or_create_key(app: &tauri::AppHandle) -> Result<[u8; 32], DbError> {
    let dir = app_data_dir(app)?;
    let path = key_path(&dir);

    if path.exists() {
        return read_key_file(&path);
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    write_key_file(&path, &key)?;
    Ok(key)
}

// ── Encryption helpers ────────────────────────────────────────────────────────

fn encrypt_data(app: &tauri::AppHandle, data: &[u8]) -> Result<Vec<u8>, DbError> {
    let key = get_or_create_key(app)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
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

fn decrypt_data(app: &tauri::AppHandle, encrypted: &[u8]) -> Result<Vec<u8>, DbError> {
    if encrypted.len() < 40 {
        return Err(DbError::Msg("Encrypted data too short".to_string()));
    }

    let data = &encrypted[ENCRYPTED_MAGIC.len()..];
    let nonce = Nonce::from_slice(&data[..12]);
    let ciphertext = &data[12..];

    let key = get_or_create_key(app)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| DbError::Msg(format!("Cipher init error: {}", e)))?;

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| DbError::Msg(format!("Decryption error: {}", e)))
}

// ── Database operations ───────────────────────────────────────────────────────

pub fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, DbError> {
    Ok(app_data_dir(app)?.join("ledger.db"))
}

fn open(path: &PathBuf) -> Result<Connection, DbError> {
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

fn backup_unreadable_db(path: &Path) {
    if !path.exists() {
        return;
    }
    let backup = path.with_extension("db.unreadable");
    let _ = std::fs::rename(path, &backup);
}

fn parse_raw_data(app: &tauri::AppHandle, data: &[u8]) -> Result<AppStateDto, DbError> {
    if data.starts_with(ENCRYPTED_MAGIC) {
        let decrypted = decrypt_data(app, data)?;
        let json_str = String::from_utf8(decrypted)
            .map_err(|e| DbError::Msg(format!("UTF-8 decode error: {}", e)))?;
        return Ok(serde_json::from_str(&json_str)?);
    }

    let json_str = String::from_utf8(data.to_vec())
        .map_err(|e| DbError::Msg(format!("UTF-8 decode error: {}", e)))?;
    Ok(serde_json::from_str(&json_str)?)
}

pub fn load_state(app: &tauri::AppHandle) -> Result<AppStateDto, DbError> {
    let path = db_path(app)?;

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
        Some(data) => match parse_raw_data(app, &data) {
            Ok(state) => Ok(state),
            Err(e) => {
                // Most common cause here: the key on disk no longer matches the
                // key the data was encrypted with (e.g. the user moved the
                // .ledger_key file, restored from an old backup, or a previous
                // build wrote with a different scheme). Log to stderr so the
                // failure is visible in `tauri dev` / packaged app logs — we
                // otherwise silently rename the user's data away.
                eprintln!(
                    "[db] load_state failed; renaming ledger.db to .unreadable and starting fresh. cause: {}",
                    e
                );
                drop(conn);
                backup_unreadable_db(&path);
                Ok(default_state())
            }
        },
        None => Ok(default_state()),
    }
}

pub fn save_state(app: &tauri::AppHandle, state: &AppStateDto) -> Result<(), DbError> {
    let path = db_path(app)?;
    let mut conn = open(&path)?;

    let json = serde_json::to_string(state)?;
    let encrypted = encrypt_data(app, json.as_bytes())?;

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![KEY_STATE, encrypted],
    )?;
    tx.commit()?;
    Ok(())
}
