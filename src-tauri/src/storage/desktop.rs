use super::{
    detect_eol, normalize_path_str, now_millis, sha256_hex, AssetPolicy, DocReadPayload, FileNode,
    SearchHit, StorageAdapter, Workspace, WriteDocPayload, WriteDocResult,
};
use base64::Engine;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub struct DesktopFsAdapter;

const IGNORED_DIRS: &[&str] = &[".git", "node_modules", "target", "dist", ".DS_Store"];
const LARGE_FILE_BYTES: u64 = 5 * 1024 * 1024;

impl DesktopFsAdapter {
    fn to_posix_rel(root: &Path, path: &Path) -> String {
        path.strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/")
    }

    fn build_nodes(root: &Path, dir: &Path, depth: usize) -> Result<Vec<FileNode>, String> {
        if depth > 8 {
            return Ok(Vec::new());
        }
        let mut entries: Vec<_> = fs::read_dir(dir)
            .map_err(|e| format!("读取目录失败: {e}"))?
            .filter_map(Result::ok)
            .collect();

        entries.sort_by(|a, b| {
            let a_dir = a.path().is_dir();
            let b_dir = b.path().is_dir();
            b_dir
                .cmp(&a_dir)
                .then_with(|| a.file_name().cmp(&b.file_name()))
        });

        let mut nodes = Vec::new();
        for entry in entries {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || IGNORED_DIRS.contains(&name.as_str()) {
                continue;
            }
            let meta = entry.metadata().ok();
            let modified_at = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            if path.is_dir() {
                let children = Self::build_nodes(root, &path, depth + 1)?;
                if !children.is_empty() {
                    let uri = normalize_path_str(&path);
                    nodes.push(FileNode {
                        id: uri.clone(),
                        name,
                        relative_path: Self::to_posix_rel(root, &path),
                        uri,
                        kind: "directory".to_string(),
                        ext: None,
                        size_bytes: None,
                        modified_at,
                        children: Some(children),
                    });
                }
            } else {
                let ext = path
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_lowercase());
                if matches!(ext.as_deref(), Some("md" | "markdown" | "mdx")) {
                    let uri = normalize_path_str(&path);
                    nodes.push(FileNode {
                        id: uri.clone(),
                        name,
                        relative_path: Self::to_posix_rel(root, &path),
                        uri,
                        kind: "file".to_string(),
                        ext,
                        size_bytes: meta.map(|m| m.len()),
                        modified_at,
                        children: None,
                    });
                }
            }
        }
        Ok(nodes)
    }
}

impl StorageAdapter for DesktopFsAdapter {
    fn open_workspace(&self, path: &Path) -> Result<Workspace, String> {
        let canonical = fs::canonicalize(path).map_err(|e| format!("无法打开工作区: {e}"))?;
        let root_uri = normalize_path_str(&canonical);
        let name = canonical
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Workspace")
            .to_string();
        Ok(Workspace {
            id: sha256_hex(root_uri.as_bytes())[..12].to_string(),
            name,
            root_uri,
            platform_origin: "desktop_path".to_string(),
            expanded_dirs: Vec::new(),
            last_opened_at: now_millis(),
        })
    }

    fn list_tree(&self, root: &Path) -> Result<Vec<FileNode>, String> {
        Self::build_nodes(root, root, 0)
    }

    fn read_doc(&self, path: &Path) -> Result<DocReadPayload, String> {
        let bytes = fs::read(path).map_err(|e| format!("读取文件失败: {e}"))?;
        let is_large_file = (bytes.len() as u64) > LARGE_FILE_BYTES;
        let has_bom = bytes.starts_with(&[0xEF, 0xBB, 0xBF]);
        let content_bytes = if has_bom { &bytes[3..] } else { &bytes[..] };
        let content = String::from_utf8_lossy(content_bytes).to_string();
        let disk_hash = sha256_hex(&bytes);
        let eol = detect_eol(&content);

        Ok(DocReadPayload {
            uri: normalize_path_str(path),
            file_name: path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("untitled.md")
                .to_string(),
            content,
            disk_hash,
            eol,
            encoding: if has_bom {
                "UTF-8-BOM".to_string()
            } else {
                "UTF-8".to_string()
            },
            is_large_file,
        })
    }

    fn write_doc_atomic(&self, payload: &WriteDocPayload) -> Result<WriteDocResult, String> {
        let target = PathBuf::from(&payload.uri);
        if let Some(expected) = &payload.expected_hash {
            if target.exists() {
                let current_bytes = fs::read(&target).map_err(|e| format!("校验原文件失败: {e}"))?;
                let current_hash = sha256_hex(&current_bytes);
                if &current_hash != expected {
                    return Err("CONFLICT: 文件已在外部修改".to_string());
                }
            }
        }

        let parent = target
            .parent()
            .ok_or_else(|| "无效的目标文件路径".to_string())?;
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;

        let tmp_name = format!(
            ".{}.{}.tmp",
            target
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("doc"),
            now_millis()
        );
        let tmp_path = parent.join(tmp_name);
        let bytes = payload.content.as_bytes();

        {
            let mut f = fs::File::create(&tmp_path).map_err(|e| format!("创建临时文件失败: {e}"))?;
            f.write_all(bytes)
                .and_then(|_| f.sync_all())
                .map_err(|e| format!("写入临时文件失败: {e}"))?;
        }

        fs::rename(&tmp_path, &target).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!("原子替换文件失败: {e}")
        })?;

        Ok(WriteDocResult {
            disk_hash: sha256_hex(bytes),
            saved_at: now_millis(),
        })
    }

    fn create_doc(&self, parent: &Path, file_name: &str, content: &str) -> Result<FileNode, String> {
        let normalized = if file_name.ends_with(".md") {
            file_name.to_string()
        } else {
            format!("{file_name}.md")
        };
        let target = parent.join(&normalized);
        if target.exists() {
            return Err(format!("文件 {normalized} 已存在"));
        }
        let body = if content.is_empty() {
            format!("# {}\n\n", normalized.trim_end_matches(".md"))
        } else {
            content.to_string()
        };
        fs::write(&target, body.as_bytes()).map_err(|e| format!("创建文档失败: {e}"))?;

        let uri = normalize_path_str(&target);
        Ok(FileNode {
            id: uri.clone(),
            name: normalized.clone(),
            relative_path: normalized,
            uri,
            kind: "file".to_string(),
            ext: Some("md".to_string()),
            size_bytes: Some(body.len() as u64),
            modified_at: now_millis(),
            children: None,
        })
    }

    fn delete_node(&self, path: &Path) -> Result<(), String> {
        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|e| format!("删除目录失败: {e}"))
        } else {
            fs::remove_file(path).map_err(|e| format!("删除文件失败: {e}"))
        }
    }

    fn rename_node(&self, path: &Path, new_name: &str) -> Result<FileNode, String> {
        let normalized = if new_name.ends_with(".md") {
            new_name.to_string()
        } else {
            format!("{new_name}.md")
        };
        let parent = path.parent().ok_or_else(|| "无法获取父目录".to_string())?;
        let target = parent.join(&normalized);
        fs::rename(path, &target).map_err(|e| format!("重命名失败: {e}"))?;

        let uri = normalize_path_str(&target);
        Ok(FileNode {
            id: uri.clone(),
            name: normalized.clone(),
            relative_path: normalized,
            uri,
            kind: "file".to_string(),
            ext: Some("md".to_string()),
            size_bytes: fs::metadata(&target).map(|m| m.len()).ok(),
            modified_at: now_millis(),
            children: None,
        })
    }

    fn save_image(
        &self,
        doc_path: &Path,
        file_name: &str,
        base64_data: &str,
        policy: &AssetPolicy,
    ) -> Result<String, String> {
        let parent = doc_path
            .parent()
            .ok_or_else(|| "无法定位文档所在目录".to_string())?;
        let sub_dir = match policy.strategy.as_str() {
            "same_name_folder" => {
                let stem = doc_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("doc");
                format!("{stem}.assets")
            }
            "custom_dir" => policy
                .custom_sub_dir
                .clone()
                .unwrap_or_else(|| "assets".to_string()),
            _ => "assets".to_string(),
        };

        let target_dir = parent.join(&sub_dir);
        fs::create_dir_all(&target_dir).map_err(|e| format!("创建图片目录失败: {e}"))?;

        let clean_name = file_name.replace(['/', '\\', ' '], "_");
        let final_name = format!("{}-{}", now_millis(), clean_name);
        let dest = target_dir.join(&final_name);

        let raw_b64 = base64_data
            .split_once(',')
            .map(|(_, data)| data)
            .unwrap_or(base64_data);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(raw_b64)
            .map_err(|e| format!("图片 Base64 解码失败: {e}"))?;

        fs::write(&dest, &bytes).map_err(|e| format!("写入图片失败: {e}"))?;

        let rel = format!("./{sub_dir}/{final_name}").replace('\\', "/");
        if policy.encode_whitespace {
            Ok(rel.replace(' ', "%20"))
        } else {
            Ok(rel)
        }
    }

    fn search_workspace(&self, root: &Path, query: &str) -> Result<Vec<SearchHit>, String> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return Ok(Vec::new());
        }

        let mut hits = Vec::new();
        for entry in WalkDir::new(root)
            .max_depth(8)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.') && !IGNORED_DIRS.contains(&name.as_ref())
            })
            .filter_map(Result::ok)
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase());
            if !matches!(ext.as_deref(), Some("md" | "markdown" | "mdx")) {
                continue;
            }

            if let Ok(content) = fs::read_to_string(path) {
                let rel = Self::to_posix_rel(root, path);
                let file_name = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("doc.md")
                    .to_string();
                for (idx, line) in content.lines().enumerate() {
                    if let Some(col) = line.to_lowercase().find(&q) {
                        hits.push(SearchHit {
                            uri: normalize_path_str(path),
                            relative_path: rel.clone(),
                            file_name: file_name.clone(),
                            line: idx + 1,
                            column: col + 1,
                            match_length: q.len(),
                            line_preview: line.trim().chars().take(120).collect(),
                        });
                        if hits.len() >= 100 {
                            return Ok(hits);
                        }
                    }
                }
            }
        }
        Ok(hits)
    }
}
