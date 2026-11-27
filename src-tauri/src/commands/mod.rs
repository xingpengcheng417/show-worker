use crate::storage::desktop::DesktopFsAdapter;
use crate::storage::{
    normalize_path_str, AssetPolicy, DocReadPayload, FileNode, OpenFileContextResult, SearchHit,
    StorageAdapter, Workspace, WriteDocPayload, WriteDocResult,
};
use crate::AppState;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, State};

fn make_doc_id(uri: &str) -> String {
    let mut hash: i32 = 0;
    for b in uri.encode_utf16() {
        hash = hash.wrapping_mul(31).wrapping_add(b as i32);
    }
    let abs = hash.unsigned_abs();
    format!("doc_{}", radix_36(abs as u64))
}

fn radix_36(mut val: u64) -> String {
    if val == 0 {
        return "0".to_string();
    }
    const CHARS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = Vec::new();
    while val > 0 {
        out.push(CHARS[(val % 36) as usize]);
        val /= 36;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_else(|_| "0".to_string())
}

#[tauri::command]
pub fn workspace_default(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<Workspace, String> {
    let doc_dir = app
        .path()
        .document_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("ShowWorkerNotes");
    fs::create_dir_all(&doc_dir).map_err(|e| format!("初始化默认笔记目录失败: {e}"))?;

    let welcome = doc_dir.join("欢迎使用 ShowWorker.md");
    if !welcome.exists() {
        let _ = fs::write(
            &welcome,
            "# 欢迎使用 ShowWorker\n\n这是一个基于 Tauri 2 + Milkdown 构建的跨平台所见即所得 Markdown 编辑器。\n\n- 按下 `Ctrl+/`（macOS 为 `⌘+/`）切换源码视图\n- 支持直接粘贴截图落盘到 `./assets/`\n",
        );
    }

    let ws = DesktopFsAdapter.open_workspace(&doc_dir)?;
    if let Ok(mut roots) = state.workspace_roots.lock() {
        roots.push(PathBuf::from(&ws.root_uri));
    }
    Ok(ws)
}

#[tauri::command]
pub fn workspace_open(path: String, state: State<'_, AppState>) -> Result<Workspace, String> {
    let ws = DesktopFsAdapter.open_workspace(&PathBuf::from(&path))?;
    if let Ok(mut roots) = state.workspace_roots.lock() {
        let root_path = PathBuf::from(&ws.root_uri);
        if !roots.contains(&root_path) {
            roots.push(root_path);
        }
    }
    Ok(ws)
}

#[tauri::command]
pub fn take_pending_open_file(state: State<'_, AppState>) -> Option<String> {
    let mut pending = state.pending_open_file.lock().ok()?;
    pending.take().map(|p| normalize_path_str(&p))
}

#[tauri::command]
pub fn open_file_context(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<OpenFileContextResult, String> {
    let raw = PathBuf::from(&file_path);
    let canonical_file = fs::canonicalize(&raw).unwrap_or(raw);
    if !canonical_file.is_file() {
        return Err(format!("文件不存在: {}", canonical_file.display()));
    }
    let parent = canonical_file
        .parent()
        .ok_or_else(|| "无法获取文件所在目录".to_string())?;
    let ws = DesktopFsAdapter.open_workspace(parent)?;
    if let Ok(mut roots) = state.workspace_roots.lock() {
        let root_path = PathBuf::from(&ws.root_uri);
        if !roots.contains(&root_path) {
            roots.push(root_path);
        }
    }
    Ok(OpenFileContextResult {
        workspace: ws,
        file_uri: normalize_path_str(&canonical_file),
    })
}

#[tauri::command]
pub fn fs_list_tree(root_uri: String) -> Result<Vec<FileNode>, String> {
    DesktopFsAdapter.list_tree(&PathBuf::from(root_uri))
}

#[tauri::command]
pub fn doc_read(uri: String, state: State<'_, AppState>) -> Result<DocReadPayload, String> {
    let path = PathBuf::from(&uri);
    let payload = DesktopFsAdapter.read_doc(&path)?;
    if let Ok(mut map) = state.doc_paths.lock() {
        map.insert(make_doc_id(&payload.uri), path);
    }
    Ok(payload)
}

#[tauri::command]
pub fn doc_write_atomic(payload: WriteDocPayload) -> Result<WriteDocResult, String> {
    DesktopFsAdapter.write_doc_atomic(&payload)
}

#[tauri::command]
pub fn doc_create(
    parent_dir_uri: String,
    file_name: String,
    initial_content: String,
) -> Result<FileNode, String> {
    DesktopFsAdapter.create_doc(&PathBuf::from(parent_dir_uri), &file_name, &initial_content)
}

#[tauri::command]
pub fn fs_delete(uri: String) -> Result<(), String> {
    DesktopFsAdapter.delete_node(&PathBuf::from(uri))
}

#[tauri::command]
pub fn fs_rename(uri: String, new_name: String) -> Result<FileNode, String> {
    DesktopFsAdapter.rename_node(&PathBuf::from(uri), &new_name)
}

#[tauri::command]
pub fn asset_save_image(
    doc_uri: String,
    file_name: String,
    base64_data: String,
    policy: AssetPolicy,
) -> Result<String, String> {
    DesktopFsAdapter.save_image(&PathBuf::from(doc_uri), &file_name, &base64_data, &policy)
}

#[tauri::command]
pub fn search_workspace(root_uri: String, query: String) -> Result<Vec<SearchHit>, String> {
    DesktopFsAdapter.search_workspace(&PathBuf::from(root_uri), &query)
}

#[tauri::command]
pub fn doc_export_html(
    app: tauri::AppHandle,
    title: String,
    html_body: String,
    theme_css: String,
) -> Result<String, String> {
    let export_dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().document_dir())
        .map_err(|e| format!("无法获取导出目录: {e}"))?;
    fs::create_dir_all(&export_dir).map_err(|e| format!("创建导出目录失败: {e}"))?;

    let stem = title.trim_end_matches(".md");
    let out_file = export_dir.join(format!("{stem}.html"));
    let html = format!(
        "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"/><title>{stem}</title><style>body{{max-width:820px;margin:40px auto;padding:0 24px;font-family:-apple-system,\"PingFang SC\",\"Segoe UI\",sans-serif;line-height:1.75;color:#1f2329;}}{theme_css}</style></head><body>{html_body}</body></html>"
    );
    fs::write(&out_file, html.as_bytes()).map_err(|e| format!("写入 HTML 失败: {e}"))?;
    Ok(out_file.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use crate::storage::normalize_path_str;
    use std::path::Path;

    #[test]
    fn strip_windows_verbatim_prefix() {
        assert_eq!(
            normalize_path_str(Path::new(r"\\?\C:\Users\demo\README.md")),
            r"C:\Users\demo\README.md"
        );
        assert_eq!(
            normalize_path_str(Path::new(r"\\?\UNC\server\share\note.md")),
            r"\\server\share\note.md"
        );
        assert_eq!(
            normalize_path_str(Path::new(r"C:\Users\demo\note.md")),
            r"C:\Users\demo\note.md"
        );
    }
}
