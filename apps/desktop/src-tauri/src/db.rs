use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;
use thiserror::Error;

const KEY_STATE: &str = "ai-subscription-tracker-v3";

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStateDto {
    pub budget: f64,
    pub rows: Vec<serde_json::Value>,
    pub bills: Vec<serde_json::Value>,
}

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
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )?;
    Ok(conn)
}

pub fn load_state(app: &tauri::AppHandle) -> Result<AppStateDto, DbError> {
    let path = db_path(app)?;
    let conn = open(&path)?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM kv WHERE key = ?1",
            params![KEY_STATE],
            |row| row.get(0),
        )
        .ok();
    if let Some(json) = raw {
        let state: AppStateDto = serde_json::from_str(&json)?;
        return Ok(state);
    }
    Ok(AppStateDto {
        budget: 500.0,
        rows: vec![],
        bills: vec![],
    })
}

pub fn save_state(app: &tauri::AppHandle, state: &AppStateDto) -> Result<(), DbError> {
    let path = db_path(app)?;
    let mut conn = open(&path)?;
    let json = serde_json::to_string(state)?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![KEY_STATE, json],
    )?;
    tx.commit()?;
    Ok(())
}