pub mod desktop;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_uri: String,
    pub platform_origin: String,
    pub expanded_dirs: Vec<String>,
    pub last_opened_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub id: String,
    pub name: String,
    pub relative_path: String,
    pub uri: String,
    pub kind: String,
    pub ext: Option<String>,
    pub size_bytes: Option<u64>,
    pub modified_at: u64,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocReadPayload {
    pub uri: String,
    pub file_name: String,
    pub content: String,
    pub disk_hash: String,
    pub eol: String,
    pub encoding: String,
    pub is_large_file: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteDocPayload {
    pub uri: String,
    pub content: String,
    pub expected_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteDocResult {
    pub disk_hash: String,
    pub saved_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub uri: String,
    pub relative_path: String,
    pub file_name: String,
    pub line: usize,
    pub column: usize,
    pub match_length: usize,
    pub line_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFileContextResult {
    pub workspace: Workspace,
    pub file_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetPolicy {
    pub strategy: String,
    pub custom_sub_dir: Option<String>,
    pub naming_rule: String,
    pub force_posix_path: bool,
    pub encode_whitespace: bool,
    pub max_paste_width_px: u32,
}

pub trait StorageAdapter {
    fn open_workspace(&self, path: &Path) -> Result<Workspace, String>;
    fn list_tree(&self, root: &Path) -> Result<Vec<FileNode>, String>;
    fn read_doc(&self, path: &Path) -> Result<DocReadPayload, String>;
    fn write_doc_atomic(&self, payload: &WriteDocPayload) -> Result<WriteDocResult, String>;
    fn create_doc(&self, parent: &Path, file_name: &str, content: &str) -> Result<FileNode, String>;
    fn delete_node(&self, path: &Path) -> Result<(), String>;
    fn rename_node(&self, path: &Path, new_name: &str) -> Result<FileNode, String>;
    fn save_image(
        &self,
        doc_path: &Path,
        file_name: &str,
        base64_data: &str,
        policy: &AssetPolicy,
    ) -> Result<String, String>;
    fn search_workspace(&self, root: &Path, query: &str) -> Result<Vec<SearchHit>, String>;
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn detect_eol(text: &str) -> String {
    let crlf = text.matches("\r\n").count();
    if crlf == 0 {
        return "LF".to_string();
    }
    let lf_only = text.replace("\r\n", "").matches('\n').count();
    if crlf >= lf_only {
        "CRLF".to_string()
    } else {
        "LF".to_string()
    }
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 统一去除 Windows `fs::canonicalize` 产生的 `\\?\` 扩展前缀，保证路径与系统传参一致。
pub fn normalize_path_str(path: &Path) -> String {
    let s = path.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        s.to_string()
    }
}
