# T-Reader Agent Guide

## 项目定位

T-Reader 是基于 Vue 3 + TypeScript + Vite 与 Tauri 2 + Rust 的 Windows 桌面阅读器。

## 运行平台与构建边界

- **目标运行平台仅为 Windows**。
- Release CI 仅构建 `x86_64-pc-windows-msvc`，不要为 Linux、macOS 或其他 Rust target 增加发布兼容逻辑。
- Windows 专属实现可以使用 Windows API / `cfg(target_os = "windows")`；涉及跨平台代码时，优先保证 Windows 发布链路的正确性。

## 开发环境分工

项目编码阶段可在**Windows**以外的操作系统例如**WSL2**中进行。

因此：

- 在 WSL2 中不要把 Linux `cargo check` / `cargo test` 的结果当作 Windows Rust 编译通过的证明。
- 涉及 Tauri/Rust 的改动完成后，应明确提示在 Windows 环境执行编译与手动测试。
- 前端静态检查可在 WSL2 执行：
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm run build`
- Rust 验证应在 Windows 环境执行，至少包括：
  - `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc`
  - `cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc`（适用时）
  - Tauri 应用启动与相关功能手动测试

## 仓库约定

- `src/`：Vue 前端。
- `src-tauri/`：Rust 后端、Tauri 配置、数据库迁移与权限声明。
- `libs/epub.js/`：git submodule，修改时确认子模块状态与指针变更。
- 发布 workflow 位于 `.github/workflows/release.yml`，当前矩阵目标为 `x86_64-pc-windows-msvc`。
- 不要覆盖或回滚工作区中与当前任务无关的既有修改；开始改动前先查看 `git status`。
- 提交信息遵循 Conventional Commits，描述使用中文，详见 `CONTRIBUTING.md`。

## 系统本地持久化目录

系统本地持久化根目录固定为 Windows 用户文档目录下的 `T-Reader/`（即 `Documents/T-Reader/`），当前目录结构如下：

```text
T-Reader/
├─ books/         # 原始书籍文件
├─ bookProgress/  # 书籍进度配置
├─ knowledge/     # 知识库导入的原始 EPUB 文件
├─ cached/        # 封面、locations、段落统计缓存，以及打包后的 logs/ 日志目录
├─ system/        # SQLite 数据库 t-reader.db
└─ fonts/         # 本地字体文件（扁平 hash.ext）
```

- `books/` 和 `bookProgress/` 的目录名称、层级及内部文件组织属于既有持久化兼容协议，不得自主改名、迁移、合并、拆分或调整文件结构。
- 只有当用户在当前任务中主动、明确声明需要修改时，才允许变更 `books/` 或 `bookProgress/` 的文件结构。

## 前端目录职责（`src/`）

本项目仅在 `src/` 范围内采用以下职责边界；新增代码应优先放入已经存在的业务模块，而不是重新创建职责重叠的目录。

- `src/assets/`：静态资源，仅保存图片、SVG、光标等二进制或设计资源，不承载业务逻辑。
- `src/components/`：可复用及页面内组合的 Vue 组件。组件自身的局部类型可放在组件目录；组件样式应遵循 `src/styles/` 规范，不能把跨组件样式散落在组件目录。
- `src/views/`：主窗口侧边栏路由对应的视图组件，负责页面编排和展示，不直接承载跨页面的基础设施实现。
- `src/composables/`：跨组件复用的 Vue 组合逻辑，负责组合响应式状态和交互流程；具体领域 API 仍归属 `services/`。
- `src/services/`：客户端核心业务服务，按领域划分：
  - `book/`：书籍原始数据流、导入、文件/缓存、元数据、书签、进度持久化和书架数据；与 epub.js 渲染解析引擎保持低耦合。
  - `reader/`：阅读器窗口的 EPUB 排版、渲染、主题应用、字体、阅读交互、阅读窗口状态及 epub.js 适配类型。
  - `chat/`：智能对话服务。
  - `fs/`：本地文件系统访问。
  - `gallery/`：画廊与图片生成服务。
  - `ipc/`：主窗口与阅读窗口等窗口进程间通信协议和桥接。
  - `knowledgeBase/`：知识库服务。
  - `notification/`：窗口消息通知服务。
  - `settings/`：主窗口设置及设置相关模型、更新、代理类型。
  - `sync/`：云同步服务，以及云同步响应体的错误、状态和消息转换。
  - `theme/`：同时适用于主窗口和阅读窗口的全局主题、调色板和阅读背景定义。
  - `window/`：窗口控制与窗口生命周期服务。
- `src/styles/`：全局样式规范，按 `global/`、`theme/`、`common/`、`components/`、`vendors/` 分类。
- `src/utils/`：与具体业务领域无关、可供任意组件或服务复用的通用工具。
- `src/constants/`：稳定的全局的常量。
- `src/router/`：主窗口路由定义。
- `src/icons/`：图标注册和图标映射，不承载业务服务。

### 类型归属规范

不新增顶层 `src/types/`。领域类型跟随所属服务维护在对应的 `types.ts` 或明确命名的类型文件中：书籍在 `services/book/types.ts`，阅读器/EPUB 在 `services/reader/`，对话在 `services/chat/`，画廊在 `services/gallery/`，知识库在 `services/knowledgeBase/`，同步在 `services/sync/`，设置/模型/更新/代理在 `services/settings/`，主题在 `services/theme/`；组件专属类型放在组件目录内。
