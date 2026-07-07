mod db;
mod ocr;

use db::{load_state, save_state, AppStateDto};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[tauri::command]
fn get_app_state(app: tauri::AppHandle) -> Result<AppStateDto, String> {
    load_state(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_app_state(app: tauri::AppHandle, state: AppStateDto) -> Result<(), String> {
    save_state(&app, &state).map_err(|e| e.to_string())
}

#[tauri::command]
fn ocr_image(data: Vec<u8>, width: u32, height: u32) -> Result<String, String> {
    ocr::ocr_image_rgba(&data, width as usize, height as usize)
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            set_app_state,
            ocr_image,
            update_tray_menu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
