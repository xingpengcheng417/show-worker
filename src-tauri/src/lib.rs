mod commands;
mod protocol;
mod storage;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::Emitter;
use tauri::Manager;

pub struct AppState {
    pub workspace_roots: Mutex<Vec<PathBuf>>,
    pub doc_paths: Mutex<HashMap<String, PathBuf>>,
    pub pending_open_file: Mutex<Option<PathBuf>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            workspace_roots: Mutex::new(Vec::new()),
            doc_paths: Mutex::new(HashMap::new()),
            pending_open_file: Mutex::new(None),
        }
    }
}

fn extract_launch_file_from_args() -> Option<PathBuf> {
    for arg in std::env::args_os().skip(1) {
        let s = arg.to_string_lossy();
        if s.starts_with('-') {
            continue;
        }
        let candidate = PathBuf::from(&arg);
        let abs = if candidate.is_absolute() {
            candidate
        } else if let Ok(cwd) = std::env::current_dir() {
            cwd.join(candidate)
        } else {
            candidate
        };
        if abs.is_file() {
            return Some(std::fs::canonicalize(&abs).unwrap_or(abs));
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .register_uri_scheme_protocol("md-asset", protocol::handle_md_asset)
        .setup(|app| {
            if let Some(launch_file) = extract_launch_file_from_args() {
                let state = app.state::<AppState>();
                if let Ok(mut pending) = state.pending_open_file.lock() {
                    *pending = Some(launch_file);
                };
            }

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(target_os = "macos")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_title_bar_style(tauri::TitleBarStyle::Overlay);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace_default,
            commands::workspace_open,
            commands::take_pending_open_file,
            commands::open_file_context,
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
        .build(tauri::generate_context!())
        .expect("error while building ShowWorker application");

    app.run(|app_handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = event {
            if let Some(path) = urls.into_iter().find_map(|u| u.to_file_path().ok()) {
                let normalized = storage::normalize_path_str(&path);
                let state = app_handle.state::<AppState>();
                if let Ok(mut pending) = state.pending_open_file.lock() {
                    *pending = Some(path);
                };
                let _ = app_handle.emit("showworker://open-file", normalized);
            }
        }
        let _ = (app_handle, event);
    });
}
