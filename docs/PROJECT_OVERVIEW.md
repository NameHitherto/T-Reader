# T-Reader 项目全景摘要

> 文档版本：2.0  
> 最后更新：2026-03-26  
> 项目版本：v0.5.2

---

## 一、项目概述

### 1.1 项目定位

T-Reader 是一个基于 Tauri 的桌面阅读器项目，当前这份仓库主要面向 **Windows 桌面端**。  
项目核心目标是提供轻量、流畅、可同步的本地阅读体验，当前已支持：

- EPUB / TXT 导入与阅读
- 书架管理与阅读进度恢复
- EPUB 书签与笔记
- WebDAV 云同步
- AI 辅助问答

移动端为独立仓库，不在本项目内维护。

### 1.2 当前技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript + Vite 5 |
| 桌面容器 | Tauri 2 + Rust |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| UI 组件 | Element Plus |
| 阅读引擎 | 二次开发的 `libs/epub.js` |
| 样式 | Sass |
| 同步 | WebDAV |
| AI 能力 | 后端 `start_stream` 转发流式模型响应 |

### 1.3 开发环境要求

| 组件 | 当前要求 |
|------|----------|
| Rust | 1.89.0 |
| Node.js（主项目） | v22.17.1 |
| Node.js（`libs/epub.js`） | v16.20.2 |

---

## 二、当前架构

### 2.1 整体结构

```
┌────────────────────────────────────────────────────────────┐
│                        T-Reader App                        │
├────────────────────────────────────────────────────────────┤
│ Frontend (Vue + TypeScript)                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ App.vue + Router + Pinia                             │ │
│ │ Components / Composables / Store                     │ │
│ │ Services                                              │ │
│ │  - book       书籍导入、仓储、缓存、展示数据         │ │
│ │  - reader     阅读器渲染、进度、样式、交互、事件     │ │
│ │  - fileSystem 目录名称与路径访问                     │ │
│ │ Constants / Utils / Icons / JS helpers               │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ Tauri IPC Bridge                                          │
├────────────────────────────────────────────────────────────┤
│ Backend (Rust)                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ command/dir.rs   本地/云端目录管理                    │ │
│ │ command/file.rs  文件读写、书籍配置、设置             │ │
│ │ command/web.rs   WebDAV 同步、AI 流式转发             │ │
│ │ command/font.rs  系统字体枚举                         │ │
│ │ command/proxy.rs 更新代理准备                         │ │
│ │ model/index.rs  Book / Settings / FontNameEntry       │ │
│ │ logging.rs      后端统一日志输出                      │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 2.2 多入口结构

项目当前是双入口桌面应用：

- `index.html` + `src/main.ts`
  - 书架主窗口
  - 路由入口为 `src/App.vue`
- `reader.html` + `src/readerMain.ts`
  - 独立阅读器窗口
  - 负责标题栏交互、样式菜单、阅读事件桥接

### 2.3 前端目录摘要

```
src/
├── assets/               # 静态资源与 SVG
├── components/           # 业务组件与对话框
│   ├── common/           # AppIcon、LoadingBlockade 等通用组件
│   ├── AssistantDialog/  # AI 对话
│   ├── BookInfoDialog/   # 书籍详情
│   ├── BookMark/         # 书签/笔记编辑
│   ├── ContextMenu/      # 右键菜单
│   ├── HelpDialog/       # 帮助
│   ├── SettingDialog/    # 设置
│   ├── StyleMenu/        # 阅读样式菜单
│   └── TocMenu/          # 目录树
├── composables/          # 组合逻辑（如 useBookmarkEditor）
├── constants/            # 窗口事件等常量
├── css/                  # 全局样式
├── font/                 # 字体资源
├── icons/                # 图标注册表
├── js/                   # 轻量类型与工具函数
├── router/               # Vue Router 路由
├── services/             # 前端服务层
│   ├── book/             # 书籍导入、仓储、缓存、元数据、展示数据
│   ├── fileSystem/       # 本地/云端目录名称访问
│   └── reader/           # 阅读器流程、进度、样式、事件、交互
├── store/                # Pinia store
├── utils/                # 通用日志等工具
├── App.vue               # 主窗口壳层
├── ReaderApp.vue         # 阅读器根组件
├── main.ts               # 主窗口入口
└── readerMain.ts         # 阅读器入口
```

### 2.4 后端目录摘要

```
src-tauri/
├── src/
│   ├── command/
│   │   ├── dir.rs        # 本地/云端目录检查与目录名返回
│   │   ├── file.rs       # 文件读写、书架配置、设置
│   │   ├── font.rs       # 系统字体读取
│   │   ├── proxy.rs      # 更新器代理
│   │   ├── web.rs        # WebDAV 与 AI 流
│   │   └── mod.rs
│   ├── model/
│   │   ├── index.rs      # Rust 数据模型
│   │   └── mod.rs
│   ├── lib.rs            # Tauri 插件与命令注册
│   ├── logging.rs        # 后端日志工具
│   └── main.rs
├── icons/
├── Cargo.toml
└── tauri.conf.json
```

---

## 三、核心前端模块

### 3.1 书籍域：`src/services/book/`

当前书籍域已经从“单一导入/解析”扩展成完整的书籍服务层，主要职责包括：

- 书籍唯一标识生成
- 导入时配置构建
- 本地/云端配置读写
- 书籍文件解析与定位
- 书籍缓存构建与命中
- 书架展示数据计算
- EPUB 全文提取供 AI 问答使用

关键文件：

| 文件 | 职责 |
|------|------|
| `bookIdentity.ts` | 生成书籍唯一标识 `name`、配置文件名、缓存文件名 |
| `bookImportService.ts` | 从导入文件生成 `BookConfig` |
| `bookRepository.ts` | 书籍配置、书籍文件、缓存、索引的统一仓储入口 |
| `bookMarksRepository.ts` | 从 `system/BookMarks.json` 统一读写所有书籍笔记 |
| `bookCacheService.ts` | 缓存封面、EPUB locations、TXT paragraphCount |
| `bookPresentationService.ts` | 计算书架阅读进度、最近阅读标签 |
| `epubContentService.ts` | 提取 EPUB 文本内容供 AI 使用 |
| `parsers/epubParser.ts` | EPUB 元数据解析 |
| `parsers/txtParser.ts` | TXT 元数据解析 |

当前数据流：

```
导入文件
  -> parse meta
  -> buildBookName(title, author)
  -> buildBookConfigFromImport()
  -> 保存 books/*.epub|txt + bookProgress/*.json
  -> 笔记独立保存到 system/BookMarks.json
  -> primeBookCacheAfterImport()
  -> 书架侧通过 bookRepository/loadBookConfigs + cache 展示
```

### 3.2 阅读器域：`src/services/reader/`

阅读器域已经拆分为更细粒度的职责模块，核心分层如下：

- `adapters/`
  - `epubAdapter.ts`
  - `txtAdapter.ts`
- 读取与加载
  - `readerLoadService.ts`
  - `readerLoadingService.ts`
  - `readerConfigService.ts`
- 渲染与样式
  - `readerStyleService.ts`
  - `renditionEventsService.ts`
  - `tocService.ts`
- 交互与行为
  - `interactionService.ts`
  - `navigationService.ts`
  - `contextMenuService.ts`
  - `readerWindowEventsService.ts`
- 数据保存
  - `readerProgressService.ts`
  - `bookmarkService.ts`
  - `txtReaderService.ts`

当前阅读流程：

```
主窗口 emit LOAD_BOOK_NAME
  -> ReaderApp 注册窗口事件
  -> loadReaderBookData(bookName)
  -> resolve format + config + cache + binary
  -> format adapter 渲染
  -> applyReaderStyles()
  -> 从 BookMarks.json 恢复当前书 location / bookmarks
  -> 用户交互
  -> saveReaderProgress(bookName, format, location, bookMarks)
```

### 3.3 文件系统域：`src/services/fileSystem/`

当前前端已经不再硬编码目录名，而是通过后端返回的目录名称访问本地与云端目录。

关键文件：

| 文件 | 职责 |
|------|------|
| `dirService.ts` | 获取本地/云端目录名称、检查目录、拼接本地目录路径 |

设计特点：

- 目录名称从 Rust 后端统一返回
- 前端不感知 `books / bookProgress / cached / system` 的硬编码来源
- 本地和云端目录检查由后端命令保证

### 3.4 状态管理

当前 Pinia store 只有两块核心状态：

| Store | 职责 |
|------|------|
| `readerConfigStore.ts` | 阅读样式配置与调节 |
| `bookMark.ts` | 当前阅读书签集合与增删改查 |

### 3.5 日志体系

本轮结构调整后，前后端都已经引入必要日志节点：

- 前端：`src/utils/logger.ts`
  - `logInfo`
  - `logWarn`
  - `logError`
  - `createDurationLogger`
- 后端：`src-tauri/src/logging.rs`
  - 统一输出 `[backend][scope] ...`
  - 支持定时起止日志

目前日志重点覆盖：

- 书架加载
- 书籍导入
- 书籍仓储回退本地/云端
- 缓存构建
- WebDAV 同步
- AI 流式调用
- 后端文件操作

---

## 四、后端命令与数据模型

### 4.1 Tauri 命令分组

#### 文件与设置：`command/file.rs`

| 命令 | 说明 |
|------|------|
| `save_file` | 以文本形式保存文件 |
| `load_books` | 读取 `bookProgress` 下所有书籍配置 |
| `delete_book` | 删除指定子目录中的文件 |
| `read_file` | 从本地目录读取二进制文件 |
| `write_file` | 写入二进制文件 |
| `read_file_by_path` | 从绝对路径读取导入文件 |
| `list_files` | 枚举本地目录文件名 |
| `save_settings` | 保存设置到 `system/setting.json` |
| `load_settings` | 从 `system/setting.json` 读取设置 |

#### 目录管理：`command/dir.rs`

| 命令 | 说明 |
|------|------|
| `check_local_dirs_command` | 检查并创建本地目录 |
| `check_cloud_dirs_command` | 检查并创建云端目录 |
| `get_local_dir_names_command` | 返回本地目录名称 |
| `get_cloud_dir_names_command` | 返回云端目录名称 |

#### WebDAV 与 AI：`command/web.rs`

| 命令 | 说明 |
|------|------|
| `webdav_upload` | 上传文件到云端 |
| `webdav_get` | 从云端下载文件 |
| `webdav_delete` | 删除云端文件 |
| `webdav_sync_files` | 同步 books 与 bookProgress（不包含 system） |
| `start_stream` | 向 AI 服务发起流式请求并转发到阅读器窗口 |

#### 其他命令

| 命令 | 模块 | 说明 |
|------|------|------|
| `get_system_fonts` | `font.rs` | 获取系统字体 |
| `prepare_updater_proxy` | `proxy.rs` | 更新代理准备 |

### 4.2 当前目录结构

本地目录根路径：

```
Document/T-Reader/
├── books/         # 原始书籍文件（epub/txt）
├── bookProgress/  # 书籍配置 JSON
├── cached/        # 书籍缓存 JSON
└── system/        # setting.json / ReaderConfig.json / BookMarks.json
```

云端目录结构：

```
WebDAV/T-Reader/
├── books/
└── bookProgress/
```

### 4.3 当前前端数据模型

#### `BookConfig`

定义位置：`src/js/map.ts`

```ts
interface BookConfig {
  name: string
  title: string
  author: string
  location?: string
  updatedAt?: string
}
```

说明：

- 当前书籍唯一标识字段已经统一为 `name`
- 旧的 `id` 已经在当前主流程中移除
- 书籍格式、封面、进度等派生信息由仓储/缓存/展示服务动态补足，不再全部固化在 `BookConfig`
- 笔记数据已从 `BookConfig` 拆出，统一保存在 `system/BookMarks.json`

#### `BookMark`

定义位置：`src/store/bookMark.ts`

```ts
interface BookMark {
  id: string
  content: string
  bookName: string
  bookTitle: string
  bookCfi: string
  createTime: string
  comments?: string
  color?: string
  hasBorder?: boolean
}
```

全局笔记文件结构：

```ts
interface BookMarksFile {
  updatedAt: string
  bookMarks: BookMark[]
}
```

#### `ReaderConfig`

定义位置：`src/store/readerConfigStore.ts`

包含：

- 字体、字号、字重
- 行距、段距、字距
- 上下左右边距
- 分栏数量、首行缩进
- 背景色、字体颜色
- 阅读流模式 `flow`

### 4.4 当前 Rust 数据模型

定义位置：`src-tauri/src/model/index.rs`

#### `Book`

```rust
pub struct Book {
    pub name: String,
    pub title: String,
    pub author: String,
    pub location: String,
    pub updated_at: Option<String>,
}
```

#### `Settings`

用于保存：

- WebDAV 根地址、文件夹、完整 URL
- 用户名与密码
- AI 开关
- 模型名、模型地址、API Key

---

## 五、页面与窗口事件

### 5.1 当前路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `MainContent.vue` | 书架主页 |
| `/bookmark` | `BookMark.vue` | 书签/笔记页 |
| `/about` | `AboutView.vue` | 关于页 |
| `/experiment` | `Experiment.vue` | 实验页 |

### 5.2 阅读器窗口事件契约

定义位置：`src/constants/events.ts`

```ts
export const WINDOW_EVENTS = {
  READY_TO_RECEIVE_BOOK_NAME: 'ready-to-receive-book-name',
  LOAD_BOOK_NAME: 'load-book-name',
  SHOW_BOOK_INFO: 'show-book-info',
  SHOW_ASSISTANT: 'show-assistant',
  SHOW_HELP: 'show-help',
  UPDATE_READER_STYLE: 'update-reader-style',
} as const
```

说明：

- 当前事件载荷已统一使用 `{ name, cfi }`
- 旧的 `LOAD_BOOK_ID / READY_TO_RECEIVE_BOOK_ID` 已废弃

---

## 六、关键技术决策

### 6.1 书籍标识统一使用 `name`

- 当前领域命名中，书籍唯一标识统一为 `name`
- `name` 由标题与作者派生生成，用于：
  - 书籍配置文件名
  - 主窗口与阅读器之间的事件传递
  - 书签归属关联
  - 书籍仓储解析与缓存命中

### 6.2 书架展示依赖缓存而非配置膨胀

- `BookConfig` 当前保持轻量
- 封面、EPUB locations、TXT 段落数、最近阅读标签、进度百分比等由服务层动态计算
- 当前缓存文件放在 `cached/` 中，由 `bookCacheService.ts` 维护
- 所有书籍笔记统一放在 `system/BookMarks.json`，不再写入 `bookProgress/*.json`

### 6.3 同步职责主要下沉到 Rust 后端

- 前端不再维护单独的 `services/sync` 目录
- WebDAV 文件同步、云端目录检查、冲突比较主要在 Rust `web.rs` 中完成
- 前端主要负责触发命令与消费结果

### 6.4 当前平台范围

- 桌面仓库当前以 Windows 为主
- `src/main.ts` 中 Android 分支已明确标记为当前不支持
- 移动端能力仍由独立仓库承载

---

## 七、构建与开发

### 7.1 常用命令

```bash
npm run dev
npm run tauri dev
npm run build
npm run tauri build
npm run preview
npm run release
```

### 7.2 开发时的重点约束

- 优先通过服务层组织业务逻辑，不在组件中直接堆叠 I/O
- 组件负责展示和事件触发，复杂逻辑下沉到 `services/`
- 书籍标识统一使用 `name`，不要回退到旧 `id`
- 阅读器相关事件统一使用 `WINDOW_EVENTS`
- 中文源码统一使用 UTF-8
- 修改前后端核心流程时同步更新本文档

### 7.3 提交前建议检查

- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- 书架导入 EPUB/TXT 正常
- 阅读器打开、定位恢复、目录、书签正常
- WebDAV 同步不会覆盖更新较新的 `bookProgress`

---

## 八、相关资源

- Tauri: https://tauri.app/
- Vue 3: https://vuejs.org/
- Pinia: https://pinia.vuejs.org/
- Element Plus: https://element-plus.org/
- epub.js fork: https://github.com/NameHitherto/epub.js
- 桌面端仓库: https://github.com/NameHitherto/T-Reader
- 移动端仓库: https://github.com/NameHitherto/T-Reader-Mobile.git

---

## 九、文档维护说明

以下情况应同步更新本文档：

1. 前端分层或目录结构发生明显调整
2. `BookConfig` / `Book` / `BookMark` 字段变化
3. Tauri 命令列表变更
4. 主窗口与阅读器的事件契约变化
5. 同步、缓存、日志等基础设施调整

---

*本文档已根据当前代码结构重新整理，后续应以代码为准持续维护。*
