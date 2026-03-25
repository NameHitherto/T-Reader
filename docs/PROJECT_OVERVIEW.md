# T-Reader 项目全景摘要

> 文档版本：1.0
> 最后更新：2026-03-25
> 项目版本：v0.5.2

---

## 一、项目概述

### 1.1 项目定位

T-Reader 是一款专注于阅读**日系轻小说**的跨平台 ePub 阅读器，采用 Tauri 框架构建，提供 Windows 桌面端和移动端（独立项目）双端体验。

### 1.2 核心技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3.3+ + TypeScript + Vite 5 |
| 桌面容器 | Tauri 2.0+ (Rust) |
| 状态管理 | Pinia 2.2+ |
| 路由 | Vue Router 4.4+ |
| UI 组件库 | Element Plus 2.8+ |
| ePub 解析 | 二次开发的 epub.js (0.3.93) |
| 样式预处理 | Sass |
| 同步协议 | WebDAV (坚果云) |
| AI 功能 | 智谱清言 / DeepSeek 大模型 |

### 1.3 开发环境要求

| 组件 | 版本要求 |
|------|----------|
| Rust (rustc) | 1.89.0 |
| Node.js (前端) | v22.17.1 |
| Node.js (epub.js) | v16.20.2 |

---

## 二、项目架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                      T-Reader App                        │
├─────────────────────────────────────────────────────────┤
│  Frontend (Vue 3 + TypeScript)                          │
│  ┌─────────────┬─────────────┬─────────────────────┐   │
│  │ Components  │ Composables │ Store (Pinia)       │   │
│  ├─────────────┴─────────────┴─────────────────────┤   │
│  │ Services Layer (业务逻辑层)                       │   │
│  │  - services/reader  (阅读流程、样式、导航、进度)  │   │
│  │  - services/book    (书籍导入、元数据、仓储)     │   │
│  │  - services/sync    (同步、Legado 映射)          │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Constants / Utils                               │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Tauri Bridge (IPC 通信层)                               │
├─────────────────────────────────────────────────────────┤
│  Backend (Rust)                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Commands (命令层)                                │   │
│  │  - file.rs     (文件读写、书籍管理、设置)        │   │
│  │  - web.rs      (WebDAV 同步、SSE 流)             │   │
│  │  - font.rs     (系统字体获取)                   │   │
│  │  - proxy.rs    (更新器代理)                     │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Model (数据模型)                                 │   │
│  │  - Book, Settings, FontNameEntry                │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Tauri Plugins                                    │   │
│  │  - fs, dialog, http, os, shell, window-state    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
d:/T-Reader/T-Reader/
├── src/                          # 前端源代码
│   ├── components/               # UI 组件
│   │   ├── common/               # 通用组件 (AppIcon 等)
│   │   ├── ContextMenu/          # 右键菜单
│   │   ├── BookMark/             # 书签相关
│   │   ├── SettingDialog/        # 设置对话框
│   │   └── ...
│   ├── composables/              # 组合式函数
│   ├── store/                    # Pinia 状态管理
│   │   ├── bookMark.ts           # 书签状态
│   │   └── readerConfigStore.ts  # 阅读器配置
│   ├── services/                 # 业务服务层
│   │   ├── reader/               # 阅读器服务
│   │   │   ├── adapters/         # 格式适配器 (epub/txt)
│   │   │   └── ...
│   │   ├── book/                 # 书籍服务
│   │   │   ├── parsers/          # 元数据解析器
│   │   │   └── ...
│   │   └── sync/                 # 同步服务
│   ├── constants/                # 常量定义
│   ├── icons/                    # 图标注册
│   │   └── registry.ts           # 图标注册表
│   ├── router/                   # 路由配置
│   ├── css/                      # 样式文件
│   ├── js/                       # 工具函数
│   │   ├── bookFormat.ts         # 书籍格式定义
│   │   ├── map.ts                # 类型定义 (BookConfig)
│   │   └── utils.ts              # 通用工具
│   ├── assets/                   # 静态资源 (SVG 图标等)
│   ├── App.vue                   # 主应用组件
│   ├── main.ts                   # 主入口 (书架)
│   └── readerMain.ts             # 阅读器入口
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── command/              # Tauri 命令
│   │   │   ├── file.rs           # 文件操作
│   │   │   ├── web.rs            # WebDAV 同步
│   │   │   ├── font.rs           # 字体服务
│   │   │   ├── proxy.rs          # 代理
│   │   │   └── mod.rs
│   │   ├── model/                # 数据模型
│   │   │   ├── index.rs          # Book, Settings 等
│   │   │   └── mod.rs
│   │   ├── lib.rs                # 库入口
│   │   └── main.rs               # 可执行入口
│   ├── icons/                    # 应用图标
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── libs/                         # 第三方库
│   └── epub.js/                  # 二次开发的 ePub 解析库
├── docs/                         # 项目文档
│   ├── PROJECT_OVERVIEW.md       # 项目全景 (本文档)
│   ├── module-architecture-spec.md  # 模块架构规范
│   ├── icon-management-spec.md   # 图标管理规范
│   └── SKILL.md                  # 开发技能规范
├── scripts/                      # 构建脚本
│   └── bump-version.js           # 版本号递增
├── package.json                  # 前端依赖
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── index.html                    # 主页面 (书架)
└── reader.html                   # 阅读器页面
```

---

## 三、核心功能模块

### 3.1 书籍管理模块 (`services/book/`)

**职责：** 书籍导入、元数据解析、持久化存储

| 文件 | 职责 |
|------|------|
| `bookImportService.ts` | 构建书籍配置，协调解析器和同步元数据 |
| `bookRepository.ts` | 书籍仓储，处理本地/云端读写 |
| `epubParser.ts` | EPUB 元数据解析 (标题、作者、封面) |
| `txtParser.ts` | TXT 元数据解析 (文件名作为标题) |
| `types.ts` | 类型定义 (`BookConfig`, `ParsedBookMeta`) |

**数据流：**
```
用户导入 → detectBookFormat → parseMeta → buildBookConfig → saveBookConfig
                                    ↓
                              (本地 + WebDAV 云同步)
```

### 3.2 阅读器模块 (`services/reader/`)

**职责：** 书籍渲染、进度管理、样式控制、用户交互

| 子目录/文件 | 职责 |
|-------------|------|
| `adapters/epubAdapter.ts` | EPUB 渲染 (调用 epub.js) |
| `adapters/txtAdapter.ts` | TXT 渲染 (段落分割) |
| `readerLoadService.ts` | 阅读器数据加载 |
| `readerProgressService.ts` | 进度保存/恢复 |
| `readerStyleService.ts` | 样式应用 |
| `navigationService.ts` | 目录导航 |
| `contextMenuService.ts` | 右键菜单 |
| `interactionService.ts` | 键盘交互 |
| `bookmarkService.ts` | 书签管理 |

**阅读流程：**
```
1. loadReaderBookData(bookId) → BookConfig + ArrayBuffer
2. 根据 format 选择 adapter:
   - epub: renderEpubBook() → Rendition + TOC
   - txt: renderTxtBook() → paragraphs[]
3. 应用样式 → applyReaderStyles()
4. 恢复进度 → display(location) / scrollTo(paragraph)
5. 监听用户操作 → saveReaderProgress()
```

### 3.3 同步模块 (`services/sync/`)

**职责：** WebDAV 同步、阅读进度跨设备同步、Legado 格式映射

| 文件 | 职责 |
|------|------|
| `syncMetaService.ts` | 附加/构建设备元数据 (deviceId, updatedAt) |
| `legadoMapper.ts` | 与"阅读"App(Legado) 的进度格式互转 |
| `legadoMapper.ts::normalizeBookConfigFromLegado` | 解决云端与本地进度冲突 (时间戳比较) |

**同步策略：**
- 云端与本地共存：下载云端 JSON 覆盖本地
- 仅本地存在：删除本地文件
- 仅云端存在：下载到本地

### 3.4 Rust 后端命令 (`src-tauri/src/command/`)

| 命令 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `save_file` | filename, contents | () | 保存文件到本地 |
| `load_books` | directory | Vec\<Book\> | 加载书架列表 |
| `delete_book` | filename | () | 删除书籍 |
| `read_file_by_path` | filepath | Vec\<u8\> | 读取文件二进制 |
| `save_settings` | json_str | () | 保存设置 |
| `load_settings` | () | Settings | 加载设置 |
| `webdav_upload` | filename, contents | () | 上传到 WebDAV |
| `webdav_get` | filename | Vec\<u8\> | 从 WebDAV 下载 |
| `webdav_delete` | filename | () | 删除 WebDAV 文件 |
| `webdav_sync_files` | directory | () | 执行全量同步 |
| `get_system_fonts` | () | Vec\<FontNameEntry\> | 获取系统字体列表 |
| `start_stream` | messages | () | AI 流式响应 (SSE) |

---

## 四、数据模型

### 4.1 BookConfig (前端)

```typescript
interface BookConfig {
  schemaVersion?: number;
  id: string;
  format?: BookFormat;  // 'epub' | 'txt'
  locationFormat?: 'cfi' | 'paragraph';
  source?: string;  // 同步源标识
  deviceId?: string;
  updatedAt?: string;
  legacySync?: {  // 与 Legado 兼容的进度数据
    bookId: string;
    progress: number;
    location: string;
    updatedAt: string;
    source: string;
    deviceId: string;
  };
  cover: string;  // Base64 封面图
  title: string;
  author: string;
  language: string;
  size: string;
  progress?: number;  // 阅读进度百分比
  lastRead: string;
  added: string;
  path: string;  // 本地文件路径
  location: string;  // 阅读位置 (CFI 或段落号)
  bookMarks?: BookMark[];
}
```

### 4.2 Book (Rust)

```rust
pub struct Book {
    pub schema_version: u32,
    pub id: String,
    pub format: String,
    pub location_format: String,
    pub cover: String,
    pub title: String,
    pub author: String,
    pub language: String,
    pub size: String,
    pub progress: Option<f64>,
    pub source: Option<String>,
    pub device_id: Option<String>,
    pub updated_at: Option<String>,
    pub last_read: String,
    pub added: String,
    pub path: String,
    pub location: String,
}
```

### 4.3 ReaderConfig (阅读设置)

```typescript
interface ReaderConfig {
  fontSize: number;           // 字号
  fontWeight: number;         // 字重
  lineSpacing: number;        // 行距
  paragraphSpacing: number;   // 段间距
  letterSpacing: number;      // 字间距
  boxPaddingTop: number;      // 内边距
  boxPaddingBottom: number;
  boxPaddingHorizontal: number;
  columnCount: number;        // 分栏数
  indent: number;             // 首行缩进
  font: string;               // 字体
  color: string;              // 背景色
  fontColor: string;          // 文字颜色
  flow: ReaderFlowMode;       // 翻页模式
}
```

---

## 五、页面路由

| 路径 | 组件 | 描述 |
|------|------|------|
| `/` | `MainContent.vue` | 书架主页 (书籍列表/网格视图) |
| `/bookmark` | `BookMark.vue` | 笔记管理页 |
| `/about` | `AboutView.vue` | 关于页面 |
| `/experiment` | `Experiment.vue` | 实验性功能页 |

**阅读器窗口：** 独立窗口，使用 `reader.html` 入口，通过窗口事件与主窗口通信。

---

## 六、窗口事件契约

定义于 `src/constants/events.ts`：

```typescript
export const WINDOW_EVENTS = {
  READY_TO_RECEIVE_BOOK_ID: 'ready-to-receive-book-id',
  LOAD_BOOK_ID: 'load-book-id',
  SHOW_BOOK_INFO: 'show-book-info',
  SHOW_ASSISTANT: 'show-assistant',
  SHOW_HELP: 'show-help',
  UPDATE_READER_STYLE: 'update-reader-style',
} as const
```

---

## 七、图标管理系统

### 7.1 图标注册表 (`src/icons/registry.ts`)

所有 SVG 图标统一注册，业务代码仅引用 `IconName` 枚举值：

```typescript
export type IconName =
  | 'addBook' | 'refresh' | 'setting'
  | 'listView' | 'gridView'
  | 'sidebarBookshelf' | 'sidebarNote' | 'sidebarAbout' | 'sidebarMore'
  | 'bookOpen' | 'delete' | 'goBack' | 'info'
  | 'bookmark' | 'delBookMark' | 'comment' | 'default'
```

### 7.2 统一图标组件 (`AppIcon/index.vue`)

```vue
<AppIcon
  :name="settingIcon"
  :size="24"
  :color="iconColor"
/>
```

**渲染模式：**
- `mask` (推荐)：使用 CSS mask 渲染单色图标，`color` 可响应式变化
- `image`：保留多色原图 (品牌 Logo)

---

## 八、设计规范摘要

### 8.1 设计原则 (from `module-architecture-spec.md`)

1. **单一职责**：模块只做一件事
2. **分层依赖**：UI → composables/store/services → 底层 I/O
3. **格式无关**：功能面向 `BookFormat` 抽象
4. **可回收生命周期**：所有监听必须可解绑
5. **常量契约化**：窗口事件、关键字段统一常量定义
6. **无需向下兼容**：早期开发阶段，测试数据可重构

### 8.2 目录职责边界

| 目录 | 职责 | 禁止项 |
|------|------|--------|
| `components` | UI 展示、交互 | 直接调用 `readFile`/`invoke` |
| `composables` | 组件复用状态与逻辑 | 处理底层协议细节 |
| `store` | 全局状态管理 | 使用 `any` 弱类型 |
| `services` | 业务逻辑与基础设施 | - |
| `constants` | 项目级常量 | - |
| `src-tauri/command` | 参数校验、调用 service | 复杂业务分支 |

### 8.3 扩展书籍格式流程

新增格式 (如 PDF/MOBI) 需完成：
1. `bookFormat.ts` 定义格式枚举
2. `services/book/parsers/` 新增元数据解析器
3. `services/reader/adapters/` 新增渲染适配器
4. `readerLoadService` / `bookRepository` 打通读取流程
5. `readerProgressService` 定义 `locationFormat` 与进度计算
6. 验证 WebDAV 同步兼容

---

## 九、构建与发布

### 9.1 开发命令

```bash
# 开发模式
npm run dev           # 启动 Vite 开发服务器
npm run tauri dev     # 启动 Tauri 开发应用

# 构建
npm run build         # 前端构建
npm run tauri build   # 构建桌面应用

# 预览
npm run preview

# 版本发布
npm run release       # 自动递增版本号
```

### 9.2 构建配置要点

**vite.config.ts：**
- 端口：1420 (严格模式)
- 多页面：`index.html` (书架) + `reader.html` (阅读器)
- 资源内联：禁用 (`assetsInlineLimit: 0`)

**tauri.conf.json：**
- 窗口：880x660，无边框模式
- 更新器：GitHub Releases + 自定义公钥

### 9.3 发布流程

1. `npm run release` 递增版本号
2. Git 提交并打 tag
3. GitHub Actions 构建
4. 生成 `latest.json` 到 Releases

---

## 十、关键技术决策

### 10.1 为什么选择 Tauri？

- 相比 Electron 更小的包体积和内存占用
- Rust 后端提供更好的系统级能力
- 支持跨平台 (Windows/Linux/Mac/Android/iOS)

### 10.2 为什么二次开发 epub.js？

- 原版不支持某些轻小说特有的排版需求
- 需要与 Legado 进度格式互转
- 修复已知 bug 和优化性能

### 10.3 为什么使用 WebDAV？

- 协议简单，易于实现
- 坚果云提供稳定免费额度
- 用户可自行更换任意 WebDAV 服务

### 10.4 Legado 格式兼容

- 移动端"阅读"App 用户基数大
- 通过 `legacySync` 字段双向兼容
- 时间戳比较解决冲突 (新胜旧)

---

## 十二、开发检查清单

### 12.1 提交前验证

- [ ] `npm run build` 通过
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` 通过
- [ ] 无跨层调用 (UI → services → command)
- [ ] 无 `any` 弱类型入口
- [ ] 生命周期清理完整 (事件监听移除)
- [ ] 图标调用通过 `AppIcon` + `registry`

### 12.2 回归测试

- [ ] EPUB：导入、打开、翻页、目录、书签、进度恢复
- [ ] TXT：导入、滚动翻页、进度保存恢复
- [ ] 窗口：标题栏按钮、样式菜单、帮助/AI/关于事件
- [ ] 同步：本地与云端往返后进度不回退

---

## 十三、相关资源

### 13.1 依赖库

- [Tauri](https://tauri.app/)
- [Vue 3](https://vuejs.org/)
- [Pinia](https://pinia.vuejs.org/)
- [Element Plus](https://element-plus.org/)
- [epub.js (fork)](https://github.com/NameHitherto/epub.js)

### 13.2 项目仓库

- [T-Reader (桌面端)](https://github.com/NameHitherto/T-Reader)

### 13.3 内部文档

- `docs/module-architecture-spec.md` - 模块架构规范
- `docs/icon-management-spec.md` - 图标管理规范

---

## 十四、文档维护指南

### 14.1 何时更新本文档

1. 新增核心功能模块
2. 架构分层发生重大调整
3. 数据模型字段变更
4. 关键技术决策变更
5. 构建/发布流程变化

### 14.2 更新责任

- 重构发起人负责同步更新本文档
- 在 PR 描述中说明变更内容
- 合并后立即更新 `docs/PROJECT_OVERVIEW.md`

---

*本文档由 Claude Code 辅助生成，最后由人工审核。*
