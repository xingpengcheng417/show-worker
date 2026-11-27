use crate::AppState;
use std::fs;
use std::path::PathBuf;
use tauri::http::{Request, Response, StatusCode};
use tauri::{Manager, UriSchemeContext};

fn guess_mime(path: &PathBuf) -> &'static str {
    match path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn bad_response(status: StatusCode, msg: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(msg.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// 处理 `md-asset://localhost/<docId>/<encoded_relative_path>` 请求，
/// 校验路径规范化后不得越出工作区边界，防止 `../` 越权读取。
pub fn handle_md_asset<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let raw_path = request.uri().path().trim_start_matches('/');
    let Some((doc_id, rel_encoded)) = raw_path.split_once('/') else {
        return bad_response(StatusCode::BAD_REQUEST, "invalid asset uri");
    };

    let decoded_rel = urlencoding::decode(rel_encoded)
        .map(|s| s.into_owned())
        .unwrap_or_else(|_| rel_encoded.to_string());

    let state = ctx.app_handle().state::<AppState>();
    let doc_path = {
        let Ok(map) = state.doc_paths.lock() else {
            return bad_response(StatusCode::INTERNAL_SERVER_ERROR, "state lock error");
        };
        map.get(doc_id).cloned()
    };

    let Some(doc_path) = doc_path else {
        return bad_response(StatusCode::NOT_FOUND, "unknown document");
    };
    let Some(doc_dir) = doc_path.parent() else {
        return bad_response(StatusCode::BAD_REQUEST, "invalid doc parent");
    };

    let candidate = doc_dir.join(decoded_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
    let Ok(canonical) = fs::canonicalize(&candidate) else {
        return bad_response(StatusCode::NOT_FOUND, "asset not found");
    };

    // 校验目标文件必须位于已授权工作区目录之内
    let allowed = state
        .workspace_roots
        .lock()
        .map(|roots| roots.iter().any(|root| canonical.starts_with(root)))
        .unwrap_or(false);

    if !allowed {
        return bad_response(StatusCode::FORBIDDEN, "asset outside authorized workspace");
    }

    match fs::read(&canonical) {
        Ok(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", guess_mime(&canonical))
            .body(bytes)
            .unwrap_or_else(|_| Response::new(Vec::new())),
        Err(_) => bad_response(StatusCode::NOT_FOUND, "unable to read asset"),
    }
}
