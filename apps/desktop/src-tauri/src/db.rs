use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use rusqlite::{params, Connection};
use security_framework::passwords::{get_generic_password, set_generic_password};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;
use thiserror::Error;

const KEY_STATE: &str = "ai-subscription-tracker-v3";
const KEYCHAIN_SERVICE: &str = "com.azhuilab.subscription-ledger";
const KEYCHAIN_KEY: &str = "encryption-key";
// Magic prefix for all new encrypted writes. Unambiguously distinguishes encrypted
// format (always starts with this prefix) from legacy unencrypted JSON (never has it).
// Length = 12 bytes, matching the AES-GCM nonce size.
const ENCRYPTED_MAGIC: &[u8] = b"SUBLEDGER_V1";

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

// ── Keychain helpers ──────────────────────────────────────────────────────────

fn get_or_create_key() -> Result<[u8; 32], DbError> {
    // Try to get existing key from Keychain
    if let Some(key_bytes) = get_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_KEY).ok() {
        if key_bytes.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&key_bytes);
            return Ok(key);
        }
        // Key exists but has wrong length — this should not happen; fail loudly
        // instead of silently generating a new key that makes old data unrecoverable.
        return Err(DbError::Msg(format!(
            "Keychain key has unexpected length {} (expected 32); cannot decrypt existing data. \
            Please delete the app and reinstall, or contact support.",
            key_bytes.len()
        )));
    }

    // Generate new key — first time setup
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);

    set_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_KEY, &key)
        .map_err(|e| DbError::Msg(format!("Keychain error: {}", e)))?;

    Ok(key)
}

// ── Encryption helpers ────────────────────────────────────────────────────────

fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, DbError> {
    let key = get_or_create_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| DbError::Msg(format!("Cipher init error: {}", e)))?;

    // Generate random 12-byte nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| DbError::Msg(format!("Encryption error: {}", e)))?;

    // Prepend magic prefix + nonce to ciphertext
    let mut result = ENCRYPTED_MAGIC.to_vec();
    result.extend_from_slice(&nonce_bytes);
    result.extend(ciphertext);
    Ok(result)
}

fn decrypt_data(encrypted: &[u8]) -> Result<Vec<u8>, DbError> {
    // Minimum: 12 (magic) + 12 (nonce) + 16 (GCM tag) = 40 bytes
    if encrypted.len() < 40 {
        return Err(DbError::Msg("Encrypted data too short".to_string()));
    }

    // Strip magic prefix; remaining: 12 (nonce) + ciphertext
    let data = &encrypted[ENCRYPTED_MAGIC.len()..];
    let nonce = Nonce::from_slice(&data[..12]);
    let ciphertext = &data[12..];

    let key = get_or_create_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| DbError::Msg(format!("Cipher init error: {}", e)))?;

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| DbError::Msg(format!("Decryption error: {}", e)))
}

// ── Database operations ───────────────────────────────────────────────────────

pub fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, DbError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DbError::Msg(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(|e| DbError::Msg(e.to_string()))?;
    Ok(dir.join("ledger.db"))
}

fn open(path: &PathBuf) -> Result<Connection, DbError> {
    let conn = Connection::open(path)?;
    // Use BLOB for encrypted binary data. If the table was created with TEXT
    // (legacy schema), migrate it to BLOB to avoid type mismatch issues.
    let schema: Result<String, _> = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE name = 'kv' AND type = 'table'",
        [],
        |row| row.get(0),
    );
    match schema {
        Ok(s) if s.contains("TEXT NOT NULL") && !s.contains("BLOB") => {
            // Legacy TEXT schema found — migrate to BLOB
            conn.execute_batch(
                "ALTER TABLE kv RENAME TO kv_old;
                 CREATE TABLE kv (key TEXT PRIMARY KEY, value BLOB NOT NULL);
                 INSERT INTO kv SELECT key, value FROM kv_old;
                 DROP TABLE kv_old;",
            )?;
        }
        _ => {
            // BLOB schema already correct, or table doesn't exist yet
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

pub fn load_state(app: &tauri::AppHandle) -> Result<AppStateDto, DbError> {
    let path = db_path(app)?;
    let conn = open(&path)?;

    // Try reading as BLOB first (current/new format), fall back to TEXT (legacy)
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
        Some(data) => {
            // Detect encrypted format by magic prefix, not by length.
            // This allows legacy unencrypted JSON (any length) to fall through
            // to JSON parse without being mistakenly decrypted.
            if data.starts_with(ENCRYPTED_MAGIC) {
                match decrypt_data(&data) {
                    Ok(decrypted) => {
                        let json_str = String::from_utf8(decrypted)
                            .map_err(|e| DbError::Msg(format!("UTF-8 decode error: {}", e)))?;
                        let state: AppStateDto = serde_json::from_str(&json_str)?;
                        return Ok(state);
                    }
                    Err(e) => return Err(e),
                }
            }
            // Legacy unencrypted format: try raw JSON
            let json_str = String::from_utf8(data)
                .map_err(|e| DbError::Msg(format!("UTF-8 decode error: {}", e)))?;
            let state: AppStateDto = serde_json::from_str(&json_str)?;
            Ok(state)
        }
        None => Ok(AppStateDto {
            budget: 500.0,
            rows: vec![],
            bills: vec![],
        }),
    }
}

pub fn save_state(app: &tauri::AppHandle, state: &AppStateDto) -> Result<(), DbError> {
    let path = db_path(app)?;
    let mut conn = open(&path)?;

    let json = serde_json::to_string(state)?;
    let encrypted = encrypt_data(json.as_bytes())?;

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![KEY_STATE, encrypted],
    )?;
    tx.commit()?;
    Ok(())
}
