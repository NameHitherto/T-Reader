# T-Reader 项目全景摘要

> 文档版本：3.0  
> 最后更新：2026-03-27  
> 项目版本：v1.0.0

## 一、项目概述

### 1.1 项目定位

T-Reader 是一个基于 `Tauri 2 + Vue 3 + Rust` 的桌面阅读器项目，当前仓库以 Windows 桌面端为主。  
项目目标是在尽量轻量的前提下，提供稳定的本地阅读、阅读进度管理和云同步体验。

当前版本已经进入 `v1.0.0`，核心能力包括：

- EPUB / TXT 导入与阅读
- 书架管理与阅读进度恢复
- EPUB 书签、高亮与笔记
- WebDAV 云同步
- AI 阅读助手
- 应用内更新

移动端仍为独立仓库，本仓库不再继续提供 Android 运行支持。

### 1.2 当前技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript + Vite 5 |
| 桌面容器 | Tauri 2 |
| 后端 | Rust |
| 状态管理 | Pinia |
| UI 组件 | Element Plus |
| 阅读引擎 | 二次开发的 `libs/epub.js` |
| 样式 | Sass |
| 同步协议 | WebDAV |
| AI 能力 | 后端 `start_stream` 流式转发 |

### 1.3 开发环境要求

| 组件 | 当前要求 |
|------|----------|
| Rust | `1.89.0` |
| Node.js（主项目） | `v22.17.1` |
| Node.js（`libs/epub.js`） | `v16.20.2` |

## 二、整体架构

### 2.1 高层结构

```text
┌────────────────────────────────────────────────────────────┐
│                        T-Reader App                        │
├────────────────────────────────────────────────────────────┤
│ Frontend (Vue + TypeScript)                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 主窗口：书架 / 笔记 / 关于 / 更多                      │ │
│ │ 阅读器：目录 / 样式 / 书签 / AI / 帮助                 │ │
│ │ Services：book / reader / fileSystem / notification   │ │
│ │ Store：readerConfig / bookMark                        │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ Tauri IPC Bridge                                          │
├────────────────────────────────────────────────────────────┤
│ Backend (Rust)                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ dir.rs   本地与云端目录管理                           │ │
│ │ file.rs  文件读写、设置、配置加载                     │ │
│ │ web.rs   WebDAV 同步与 AI 流式转发                    │ │
│ │ font.rs  系统字体枚举                                 │ │
│ │ proxy.rs 更新器代理探测                               │ │
│ │ logging.rs 统一日志                                   │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 2.2 双入口窗口结构

项目当前是双入口桌面应用：

- `index.html` + `src/main.ts`
  - 主窗口入口
  - 负责书架、笔记页、关于页、设置与同步
- `reader.html` + `src/readerMain.ts`
  - 独立阅读器窗口入口
  - 负责阅读、目录、样式菜单、书签、AI 与帮助

### 2.3 当前路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `MainContent.vue` | 书架主页 |
| `/bookmark` | `BookMark.vue` | 全局笔记页 |
| `/about` | `AboutView.vue` | 版本信息与应用内更新 |
| `/experiment` | `Experiment.vue` | 实验页占位 |

## 三、前端目录与模块

### 3.1 目录摘要

```text
src/
├── assets/               # 图片、SVG、鼠标样式等静态资源
├── components/           # 页面组件、弹窗、通用组件
├── composables/          # 组合逻辑
├── constants/            # 事件名、字体排除等常量
├── css/                  # 全局样式
├── icons/                # 图标注册表
├── js/                   # 轻量工具与桥接代码
├── router/               # 主窗口路由
├── services/             # 业务服务层
│   ├── book/             # 导入、解析、仓储、缓存、展示
│   ├── fileSystem/       # 本地 / 云端目录访问
│   ├── notification/     # 主任务通知
│   └── reader/           # 阅读器加载、进度、样式、导航、交互
├── store/                # Pinia store
├── App.vue               # 主窗口壳层
├── ReaderApp.vue         # 阅读器根组件
├── main.ts               # 主窗口入口
└── readerMain.ts         # 阅读器入口
```

### 3.2 书籍域：`src/services/book/`

书籍域负责导入、识别、仓储、缓存与书架展示数据组织。

关键职责：

- 解析导入文件元数据
- 根据标题与作者生成内部唯一标识 `bookKey`
- 保存书籍原文件与进度配置
- 解析并维护缓存文件
- 为书架计算封面、标题、最近阅读与进度
- 为 AI 助手提取书籍正文

关键文件：

| 文件 | 职责 |
|------|------|
| `bookImportService.ts` | 从导入文件构建 `BookConfig` |
| `bookRepository.ts` | 统一读取本地 / 云端配置与原书文件 |
| `bookCacheService.ts` | 缓存封面、EPUB locations、TXT 段落数 |
| `bookMarksRepository.ts` | 统一读写 `system/BookMarks.json` |
| `bookPresentationService.ts` | 计算书架进度与最近阅读标签 |
| `epubContentService.ts` | 为 AI 助手提取正文 |
| `parsers/epubParser.ts` | EPUB 元数据解析 |
| `parsers/txtParser.ts` | TXT 元数据解析 |

### 3.3 阅读器域：`src/services/reader/`

阅读器域按职责拆分较细，是当前前端最核心的业务区域。

主要分层：

- `adapters/`
  - `epubAdapter.ts`
  - `txtAdapter.ts`
- 加载与配置
  - `readerLoadService.ts`
  - `readerLoadingService.ts`
  - `readerConfigService.ts`
- 样式与渲染
  - `readerStyleService.ts`
  - `renditionEventsService.ts`
  - `tocService.ts`
- 交互与导航
  - `interactionService.ts`
  - `navigationService.ts`
  - `contextMenuService.ts`
  - `readerWindowEventsService.ts`
- 进度与书签
  - `readerProgressService.ts`
  - `progressSnapshotService.ts`
  - `bookmarkService.ts`
  - `txtReaderService.ts`

### 3.4 文件系统与通知

| 目录 | 说明 |
|------|------|
| `services/fileSystem/dirService.ts` | 统一从后端获取本地 / 云端目录名，避免前端硬编码 |
| `services/notification/mainTaskMessageService.ts` | 负责主窗口导入、同步、更新等任务通知 |

### 3.5 Store

| Store | 说明 |
|------|------|
| `readerConfigStore.ts` | 阅读样式配置 |
| `bookMark.ts` | 当前阅读书籍的书签集合 |

## 四、主要用户能力

### 4.1 书架

主窗口 `MainContent.vue` 当前提供：

- 导入 EPUB / TXT 书籍
- 书架列表 / 网格双视图切换
- 封面、书名、作者、最近阅读、阅读进度展示
- 书籍右键菜单：打开、查看信息、删除
- 触发云同步
- 打开设置中心

### 4.2 阅读器

`ReaderApp.vue` 当前支持：

- EPUB 分页阅读
- TXT 滚动阅读
- 目录抽屉与章节跳转
- 阅读进度展示
- 上一页 / 下一页操作
- 键盘快捷键与全屏沉浸阅读
- 右键高亮、书签与评论
- AI 助手与帮助弹窗

### 4.3 笔记页

`BookMark.vue` 当前提供：

- 全局浏览所有书签 / 笔记
- 标签视图与表格视图切换
- 书签删除
- 从笔记跳转回具体阅读位置

### 4.4 关于页

`AboutView.vue` 当前提供：

- 当前版本展示
- 检查更新
- 下载并安装更新
- 检测系统 / 环境代理后进行更新请求

## 五、数据模型与数据落盘

### 5.1 前端核心数据模型

#### `BookConfig`

定义位置：`src/js/map.ts`

```ts
interface BookConfig {
  name: string
  author: string
  durChapterIndex: number
  durChapterPos: number
  durChapterTitle: string
  durChapterTime: number
}
```

说明：

- `name` 用于展示，不承担内部唯一标识职责
- 内部唯一标识由 `bookKey` 承担，来源于配置文件名
- 阅读进度由 `durChapter*` 字段保存

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

#### `ReaderConfig`

定义位置：`src/store/readerConfigStore.ts`

当前主要包含：

- 字体、字号、字重
- 行距、段距、字距
- 顶部 / 底部 / 水平边距
- 分栏数量、首行缩进
- 背景色、字体颜色
- 阅读流模式 `flow`

### 5.2 Rust 数据模型

定义位置：`src-tauri/src/model/index.rs`

- `Book`
- `StoredBook`
- `Settings`
- `FontNameEntry`

其中 `Settings` 负责保存：

- WebDAV 根地址、子目录、完整地址
- WebDAV 用户名与密码
- AI 开关、模型名、模型地址、API Key

### 5.3 本地目录结构

本地根目录位于 `Document/T-Reader/`：

```text
Document/T-Reader/
├── books/         # 原始书籍文件
├── bookProgress/  # <bookKey>.json
├── cached/        # <bookKey>.json
└── system/
    ├── setting.json
    ├── ReaderConfig.json
    └── BookMarks.json
```

### 5.4 云端目录结构

```text
WebDAV/T-Reader/
├── books/
└── bookProgress/
```

说明：

- 当前云端不保存 `cached/`
- 当前云端不保存 `system/BookMarks.json`
- 同步阶段会比较本地与云端进度文件中的 `durChapterTime`

## 六、阅读与同步流程

### 6.1 导入流程

```text
选择文件
  -> 解析元数据
  -> 生成 bookKey / BookConfig
  -> 保存 books/<originalFilename>
  -> 保存 bookProgress/<bookKey>.json
  -> 预热 cached/<bookKey>.json
  -> 异步上传 books / bookProgress 到 WebDAV
  -> 刷新书架展示
```

### 6.2 阅读流程

```text
主窗口发送 LOAD_BOOK_KEY
  -> 阅读器加载 BookConfig + Cache + 原始文件
  -> 根据格式选择 EPUB / TXT adapter
  -> 应用 ReaderConfig 样式
  -> 恢复阅读位置
  -> 恢复当前书籍书签
  -> 用户继续阅读
  -> 关闭窗口或切书时保存进度
```

### 6.3 同步流程

`webdav_sync_files` 当前只同步：

- `books/`
- `bookProgress/`

同步规则：

- 本地有、云端无：上传
- 云端有、本地无：下载
- 本地与云端都存在：
  - 若本地 `durChapterTime` 更新，则上传本地
  - 否则下载云端覆盖本地

## 七、Tauri 命令清单

### 7.1 文件与设置：`src-tauri/src/command/file.rs`

| 命令 | 说明 |
|------|------|
| `save_settings` | 保存 `system/setting.json` |
| `load_settings` | 读取设置 |
| `save_file` | 保存文本文件 |
| `load_books` | 加载 `bookProgress` 中的全部书籍配置 |
| `delete_book` | 删除本地指定文件 |
| `read_file` | 读取本地文件 |
| `write_file` | 写入本地二进制文件 |
| `read_file_by_path` | 读取绝对路径文件 |
| `list_files` | 枚举目录文件名 |

### 7.2 目录管理：`src-tauri/src/command/dir.rs`

| 命令 | 说明 |
|------|------|
| `check_local_dirs_command` | 检查并创建本地目录 |
| `check_cloud_dirs_command` | 检查并创建 WebDAV 目录 |
| `get_local_dir_names_command` | 返回本地目录名称 |
| `get_cloud_dir_names_command` | 返回云端目录名称 |

### 7.3 WebDAV 与 AI：`src-tauri/src/command/web.rs`

| 命令 | 说明 |
|------|------|
| `webdav_upload` | 上传文件到云端 |
| `webdav_get` | 下载云端文件 |
| `webdav_delete` | 删除云端文件 |
| `webdav_sync_files` | 同步 `books` 与 `bookProgress` |
| `start_stream` | 向模型服务发起流式请求并转发到阅读器 |

### 7.4 其他命令

| 命令 | 模块 | 说明 |
|------|------|------|
| `get_system_fonts` | `font.rs` | 枚举系统字体 |
| `prepare_updater_proxy` | `proxy.rs` | 为更新器准备代理环境 |

## 八、窗口事件契约

定义位置：`src/constants/events.ts`

```ts
export const WINDOW_EVENTS = {
  READY_TO_RECEIVE_BOOK_KEY: 'ready-to-receive-book-key',
  LOAD_BOOK_KEY: 'load-book-key',
  SHOW_BOOK_INFO: 'show-book-info',
  SHOW_ASSISTANT: 'show-assistant',
  SHOW_HELP: 'show-help',
  UPDATE_READER_STYLE: 'update-reader-style',
} as const
```

说明：

- 主窗口与阅读器通过 `bookKey` 通信
- 阅读器样式菜单通过事件触发重新应用样式
- 关于本书、AI 助手、帮助弹窗由标题栏按钮触发事件打开

## 九、当前约束与注意事项

- 当前桌面仓库以 Windows 为主要目标平台
- `src/main.ts` 已明确标记 Android 平台不再支持
- AI 助手默认读取当前书籍正文摘要；TXT 会退化为截取部分文本
- `Experiment.vue` 目前仍是占位页面
- 文档与实现以当前代码为准，涉及目录、字段、命令变化时应同步更新

## 十、构建与验证

### 10.1 常用命令

```bash
npm run dev
npm run tauri dev
npm run build
npm run tauri build
npm run preview
npm run release -- v1.0.1
```

`npm run release` 只会更新并推送 `release` 分支，不再操作 `develop` 分支。

### 10.2 建议回归项

- EPUB：导入、打开、目录、翻页、书签、笔记、进度恢复
- TXT：导入、滚动阅读、进度恢复
- 书架：列表 / 网格切换、封面与进度显示
- WebDAV：双向同步与冲突择优
- 更新器：检查更新流程

## 十一、相关资源

- Tauri: https://tauri.app/
- Vue 3: https://vuejs.org/
- Pinia: https://pinia.vuejs.org/
- Element Plus: https://element-plus.org/
- epub.js fork: https://github.com/NameHitherto/epub.js
- 桌面端仓库: https://github.com/NameHitherto/T-Reader
- 移动端仓库: https://github.com/NameHitherto/T-Reader-Mobile
