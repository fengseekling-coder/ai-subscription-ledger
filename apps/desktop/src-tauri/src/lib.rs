mod db;
mod monitor;
mod ocr;

use db::{load_state, save_state, AppStateDto};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

/// Background flag: set to `true` to stop the monitor scheduler thread.
static MONITOR_SHUTDOWN: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn get_app_state(app: tauri::AppHandle) -> Result<AppStateDto, String> {
    load_state(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_app_state(app: tauri::AppHandle, state: AppStateDto) -> Result<(), String> {
    save_state(&app, &state).map_err(|e| e.to_string())
}

// Security limits for OCR
const MAX_OCR_WIDTH: u32 = 4096;
const MAX_OCR_HEIGHT: u32 = 4096;

// OCR takes raw RGBA bytes directly. The frontend decodes clipboard/file
// images once via Canvas → ImageData and hands the raw buffer to us — this
// avoids a second encode/decode roundtrip (e.g. Canvas → PNG → image crate
// decode) on every OCR call.
#[tauri::command]
fn ocr_image(data: Vec<u8>, width: u32, height: u32) -> Result<String, String> {
    if width == 0 || height == 0 {
        return Err("图片尺寸不能为零".to_string());
    }
    if width > MAX_OCR_WIDTH || height > MAX_OCR_HEIGHT {
        return Err(format!("图片尺寸超出限制（最大 {}x{}）", MAX_OCR_WIDTH, MAX_OCR_HEIGHT));
    }
    let expected_len = (width as u64) * (height as u64) * 4;
    if (data.len() as u64) != expected_len {
        return Err("图片数据长度与尺寸不匹配".to_string());
    }
    ocr::ocr_image_rgba(&data, width as usize, height as usize)
}

// ── Monitor commands ──────────────────────────────────────────────────────────

#[tauri::command]
async fn check_monitor_cmd(monitor_id: String, service_id: String, api_key: String) -> Result<monitor::MonitorCheckResult, String> {
    let input = monitor::MonitorInput {
        id: monitor_id,
        catalog_id: String::new(),
        service_id,
        api_key,
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    Ok(monitor::check_monitor(&client, &input).await)
}

#[tauri::command]
async fn check_all_monitors_cmd(monitors: Vec<monitor::MonitorInput>) -> Result<Vec<monitor::MonitorCheckResult>, String> {
    Ok(monitor::check_all_monitors(&monitors).await)
}

#[tauri::command]
fn get_supported_services() -> Vec<monitor::SupportedService> {
    monitor::supported_services()
}

#[tauri::command]
fn update_tray_menu(app: tauri::AppHandle, pending_count: u32, nearest_label: String) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main-tray") else {
        return Ok(());
    };
    let title = if pending_count > 0 {
        format!("待续费 {} 项", pending_count)
    } else {
        "暂无待续费".to_string()
    };
    let menu = build_tray_menu(&app, &title, &nearest_label).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    let tip = if pending_count > 0 {
        format!("订阅账本 · {} 项待续费", pending_count)
    } else {
        "订阅账本".to_string()
    };
    let _ = tray.set_tooltip(Some(tip));
    Ok(())
}

// ── Tray setup ────────────────────────────────────────────────────────────────

fn build_tray_menu(app: &tauri::AppHandle, pending_title: &str, nearest: &str) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let pending = MenuItem::with_id(app, "pending", pending_title, true, None::<&str>)?;
    let nearest_item = MenuItem::with_id(app, "nearest", nearest, false, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    Menu::with_items(app, &[&show, &pending, &nearest_item, &sep, &quit])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let pending_title = "暂无待续费";
            let nearest = "下一续费：—";
            let menu = build_tray_menu(app.handle(), pending_title, nearest)?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "pending" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("navigate", "pending");
                        }
                    }
                    "quit" => {
                        MONITOR_SHUTDOWN.store(true, Ordering::Relaxed);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .tooltip("订阅账本");

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            // ── Background monitor scheduler ────────────────────────────────
            // Check all monitors every 6 hours; emit "monitor-updated" event
            // so the frontend can refresh state. The flag is checked each
            // iteration so the thread exits cleanly when the app quits.
            {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    while !MONITOR_SHUTDOWN.load(Ordering::Relaxed) {
                        std::thread::sleep(std::time::Duration::from_secs(6 * 60 * 60));
                        if MONITOR_SHUTDOWN.load(Ordering::Relaxed) {
                            break;
                        }
                        let handle = app_handle.clone();
                        // Best-effort: load state, run checks, emit event.
                        // Errors are silently ignored to avoid crashing the thread.
                        if let Ok(mut state) = load_state(&handle) {
                            let monitors_json = &state.monitors;
                            if monitors_json.is_empty() {
                                continue;
                            }
                            let inputs: Vec<monitor::MonitorInput> = monitors_json
                                .iter()
                                .filter_map(|v| {
                                    let id = v.get("id")?.as_str()?.to_string();
                                    let catalog_id = v.get("catalogId").and_then(|x| x.as_str()).unwrap_or("").to_string();
                                    let service_id = v.get("serviceId")?.as_str()?.to_string();
                                    let api_key = v.get("apiKey")?.as_str()?.to_string();
                                    Some(monitor::MonitorInput { id, catalog_id, service_id, api_key })
                                })
                                .collect();
                            if inputs.is_empty() {
                                continue;
                            }
                            let results =
                                futures_lite::future::block_on(monitor::check_all_monitors(&inputs));
                            let now = chrono::Utc::now().to_rfc3339();
                            let mut updated_monitors = monitors_json.clone();
                            for r in &results {
                                if let Some(v) = updated_monitors.iter_mut().find(|m| {
                                    m.get("id").and_then(|x| x.as_str()) == Some(r.monitor_id.as_str())
                                }) {
                                    if let Some(obj) = v.as_object_mut() {
                                        obj.insert("lastChecked".into(), serde_json::Value::String(now.clone()));
                                        obj.insert("status".into(), serde_json::Value::String(r.status.clone()));
                                        obj.insert("statusDetail".into(), serde_json::Value::String(r.status_detail.clone()));
                                        obj.insert("remotePlan".into(), serde_json::Value::String(r.remote_plan.clone()));
                                        obj.insert("remoteAmount".into(), serde_json::json!(r.remote_amount));
                                        obj.insert("remoteRenewalDate".into(), serde_json::Value::String(r.remote_renewal_date.clone()));
                                        obj.insert("errorMessage".into(), serde_json::Value::String(r.error_message.clone()));
                                    }
                                }
                            }
                            state.monitors = updated_monitors;
                            if let Err(e) = save_state(&handle, &state) {
                                eprintln!("[monitor-scheduler] save_state failed: {}", e);
                            }
                            if let Err(e) = handle.emit("monitor-updated", ()) {
                                eprintln!("[monitor-scheduler] emit event failed: {}", e);
                            }
                        }
                    }
                    eprintln!("[monitor-scheduler] thread exiting");
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            set_app_state,
            ocr_image,
            update_tray_menu,
            check_monitor_cmd,
            check_all_monitors_cmd,
            get_supported_services,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
