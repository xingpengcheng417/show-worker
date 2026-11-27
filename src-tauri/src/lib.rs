mod commands;
mod protocol;
mod storage;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use tauri::Manager;

pub struct AppState {
    pub workspace_roots: Mutex<Vec<PathBuf>>,
    pub doc_paths: Mutex<HashMap<String, PathBuf>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            workspace_roots: Mutex::new(Vec::new()),
            doc_paths: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .register_uri_scheme_protocol("md-asset", protocol::handle_md_asset)
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(target_os = "macos")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_title_bar_style(tauri::TitleBarStyle::Overlay);
                }
            }
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace_default,
            commands::workspace_open,
            commands::fs_list_tree,
            commands::doc_read,
            commands::doc_write_atomic,
            commands::doc_create,
            commands::fs_delete,
            commands::fs_rename,
            commands::asset_save_image,
            commands::search_workspace,
            commands::doc_export_html,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ShowWorker application");
}
