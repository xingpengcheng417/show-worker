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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubReleaseInfo {
    pub version: String,
    pub tag_name: String,
    pub date: Option<String>,
    pub body: Option<String>,
    pub release_url: String,
    pub download_url: String,
}

#[derive(Debug, serde::Deserialize)]
struct GithubAssetPayload {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, serde::Deserialize)]
struct GithubReleasePayload {
    tag_name: String,
    published_at: Option<String>,
    body: Option<String>,
    html_url: String,
    #[serde(default)]
    assets: Vec<GithubAssetPayload>,
}

fn pick_release_download_url(assets: &[(String, String)], release_url: &str, os: &str) -> String {
    let find_suffix = |suffix: &str| {
        assets
            .iter()
            .find(|(name, _)| name.to_ascii_lowercase().ends_with(suffix))
            .map(|(_, url)| url.clone())
    };

    match os {
        "windows" => find_suffix("-setup.exe")
            .or_else(|| find_suffix(".exe"))
            .or_else(|| find_suffix(".msi"))
            .unwrap_or_else(|| release_url.to_string()),
        "macos" => find_suffix(".dmg")
            .or_else(|| find_suffix(".app.tar.gz"))
            .unwrap_or_else(|| release_url.to_string()),
        _ => release_url.to_string(),
    }
}

fn validate_external_url(url: &str) -> Result<(), String> {
    if url.is_empty() || (!url.starts_with("https://") && !url.starts_with("http://")) {
        return Err("仅允许打开 http:// 或 https:// 协议的链接".to_string());
    }
    if url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("链接中包含非法空白或控制字符".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn check_github_latest_release() -> Result<Option<GithubReleaseInfo>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .user_agent("ShowWorker-Updater")
            .build()
            .map_err(|e| format!("初始化 HTTP 客户端失败: {e}"))?;

        let resp = client
            .get("https://api.github.com/repos/xingpengcheng417/show-worker/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| format!("请求 GitHub Releases 失败: {e}"))?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !resp.status().is_success() {
            return Err(format!("GitHub API 返回状态码: {}", resp.status()));
        }

        let payload: GithubReleasePayload = resp
            .json()
            .await
            .map_err(|e| format!("解析 GitHub Release JSON 失败: {e}"))?;

        let version = payload
            .tag_name
            .trim_start_matches(['v', 'V'])
            .to_string();

        let assets: Vec<(String, String)> = payload
            .assets
            .into_iter()
            .map(|a| (a.name, a.browser_download_url))
            .collect();

        let download_url =
            pick_release_download_url(&assets, &payload.html_url, std::env::consts::OS);

        Ok(Some(GithubReleaseInfo {
            version,
            tag_name: payload.tag_name,
            date: payload.published_at,
            body: payload.body,
            release_url: payload.html_url,
            download_url,
        }))
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    validate_external_url(&url)?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| format!("无法在浏览器打开链接: {e}"))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("无法在浏览器打开链接: {e}"))?;
        Ok(())
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("无法在浏览器打开链接: {e}"))?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", unix)))]
    {
        Err("当前平台暂不支持打开外部链接".to_string())
    }
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
    use super::{pick_release_download_url, validate_external_url};
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

    #[test]
    fn select_platform_installer_asset() {
        let release_url = "https://github.com/xingpengcheng417/show-worker/releases/tag/v0.1.1";
        let assets = vec![
            (
                "ShowWorker_0.1.1_x64_en-US.msi".to_string(),
                "https://example.com/ShowWorker_0.1.1_x64_en-US.msi".to_string(),
            ),
            (
                "ShowWorker_0.1.1_x64-setup.exe".to_string(),
                "https://example.com/ShowWorker_0.1.1_x64-setup.exe".to_string(),
            ),
            (
                "ShowWorker_0.1.1_universal.dmg".to_string(),
                "https://example.com/ShowWorker_0.1.1_universal.dmg".to_string(),
            ),
        ];

        assert_eq!(
            pick_release_download_url(&assets, release_url, "windows"),
            "https://example.com/ShowWorker_0.1.1_x64-setup.exe"
        );
        assert_eq!(
            pick_release_download_url(&assets, release_url, "macos"),
            "https://example.com/ShowWorker_0.1.1_universal.dmg"
        );
        assert_eq!(
            pick_release_download_url(&[], release_url, "windows"),
            release_url
        );
    }

    #[test]
    fn reject_unsafe_external_urls() {
        assert!(validate_external_url("https://github.com/xingpengcheng417/show-worker").is_ok());
        assert!(validate_external_url("http://example.com/setup.exe").is_ok());
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("https://example.com/a b").is_err());
        assert!(validate_external_url("").is_err());
    }
}
