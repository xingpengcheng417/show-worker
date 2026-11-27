# ShowWorker · 跨平台 Typora 风格 Markdown 编辑器

基于 **Tauri 2.x + React + TypeScript + Milkdown + CodeMirror 6** 构建的轻量级 Markdown 编辑器，面向 **Windows / macOS** 桌面端并预留 **iPadOS / iOS** 扩展能力。

## 核心特性

- **Typora 风格沉浸所见即所得**：基于 Milkdown (ProseMirror + Remark)，支持行内/块级语法瞬时渲染、表格上下文工具条、划词格式浮窗、斜杠块菜单（`/`）、专注模式与打字机居中滚动。
- **双模无缝切换**：按下 `Ctrl+/`（macOS 为 `⌘+/`）可在所见即所得与 CodeMirror 6 源码模式间即时切换。
- **无损往返与安全写入**：独立隔离编辑 YAML Frontmatter，保留原文件 `LF` / `CRLF` 换行符，支持 800ms 防抖崩溃恢复草稿及 Rust 临时文件原子写（`.tmp -> rename`）。
- **数学公式与图表预览**：内置 KaTeX 数学公式与 Mermaid 架构图实时渲染卡片。
- **跨端本地图片闭环**：支持粘贴/拖拽截图落盘到 `./assets/` 并强制写入 POSIX `/` 相对路径，桌面端通过 `md-asset://` 自定义协议安全加载本地图片。

## 目录结构

```text
show-worker/
├── docs/                  # 详细设计方案与可交互 HTML 原型
├── src/
│   ├── core/              # 数据模型、Frontmatter/EOL/大纲解析、跨端快捷键
│   ├── editor/            # Milkdown 所见即所得内核与 CodeMirror 6 源码视图
│   ├── services/          # Tauri/Web 平台适配器、恢复快照、Zustand 状态机
│   ├── components/        # 自适应标题栏、侧边栏、状态栏、移动端工具条
│   └── themes/            # 纸感浅 / 羊皮纸 / 深夜黑 / 跟随系统 Design Tokens
├── src-tauri/             # Tauri 2 Rust 宿主、DesktopFsAdapter 与 md-asset:// 协议
└── .github/workflows/     # Windows & macOS 双端自动构建 CI
```

## 本地开发与校验

### 1. 前端调试与浏览器预览（仅需 Node.js）

```bash
npm install
npm run dev       # http://localhost:1420（自动启用 Web 演示适配器）
npm run typecheck # TypeScript 类型检查
npm test          # 运行 Vitest 单元测试
npm run build     # 生产构建
```

### 2. 桌面端完整运行（Windows / macOS）

运行桌面原生窗口需要安装 **Rust 工具链** 与对应系统构建依赖：

- **Windows**：安装 [Rust (rustup)](https://rustup.rs/) 与 Visual Studio C++ Build Tools（MSVC + Windows SDK）。
- **macOS**：安装 Rust 与 Xcode Command Line Tools (`xcode-select --install`)。

安装完成后执行：

```bash
npm run tauri dev
npm run tauri build
# 单文件便携版 exe：npm run tauri build -- --no-bundle（输出至 src-tauri/target/release/ShowWorker.exe 及 release/ShowWorker.exe）
```

### 3. 自动更新与新版本发布指南

桌面端已内置 `tauri-plugin-updater`，启动 3 秒后自动检测 GitHub Releases 的 `latest.json` 清单，也可点击右下角状态栏版本号手动检查并一键下载重启更新。

1. **首次配置 GitHub Actions 签名私钥**（仅需一次）：
   - 在 GitHub 仓库打开 `Settings -> Secrets and variables -> Actions -> New repository secret`。
   - 新建 Secret `TAURI_SIGNING_PRIVATE_KEY`，值填入本机签名私钥文件内容（例如 `C:\Users\79235\.tauri\show-worker.key`）。
2. **发布新版本（例如 `0.2.0`）**：
   - 将 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 中的版本号同步升级为 `0.2.0`。
   - 提交代码后打标签并推送：`git tag v0.2.0 && git push origin main --tags`。
   - `.github/workflows/release.yml` 会自动构建签名版 Windows/macOS 安装包并生成 `latest.json`，旧版本客户端即可自动检测到更新。
