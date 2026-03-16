# T-Reader 模块规范（解耦版）

本规范用于约束二次开发时的代码组织、职责边界、事件契约与提交流程，目标是在保持现有 EPUB/TXT 功能稳定的前提下，持续提升可维护性与可扩展性。

## 1. 设计原则

1. 单一职责：每个模块只做一件事，不在组件中混入存储、网络、解析、渲染多种职责。
2. 分层依赖：UI 只能依赖 composables/store/services，不直接依赖底层 I/O 或同步实现。
3. 格式无关：功能优先面向 BookFormat 抽象，不写死 .epub 路径或 cfi 专有逻辑。
4. 可回收生命周期：所有事件监听、DOM 绑定、窗口绑定都必须可解绑。
5. 常量契约化：窗口事件、同步字段、关键字符串统一常量定义，禁止散落字符串。

## 2. 目录职责

### 2.1 前端目录划分

1. src/components
- 仅承载界面与交互展示。
- 不直接调用 readFile/writeFile/invoke 执行持久化或同步。

2. src/composables
- 承载组件复用状态与交互逻辑。
- 允许依赖 store 与 services，不处理底层协议细节。

3. src/store
- 管理全局状态与最小状态变更 API。
- 必须强类型，禁止 any 与 String 这类弱类型入口。

4. src/services
- 承载业务逻辑与基础设施访问。
- 子域划分：
  - services/reader：阅读流程、样式、事件、导航、进度。
  - services/book：书籍导入、元数据解析、仓储读写。
  - services/sync：同步元信息、第三方映射（如 legado）。

5. src/constants
- 存放项目级常量与事件名。
- 示例：WINDOW_EVENTS、fontExclusion。

6. src/js
- 仅保留纯工具与轻量初始化桥接。
- 若逻辑具备业务语义（如 EPUB 内容提取），必须迁入 services。

### 2.2 Rust 侧目录划分

1. src-tauri/src/command
- 仅做参数接收、校验、调用 service/repository。
- 不承载复杂业务分支。

2. src-tauri/src/model
- 前后端共享数据结构的 Rust 表达。
- 新字段必须考虑 serde default 与兼容。

## 3. 核心边界约束

### 3.1 UI 层禁止项

1. 组件中直接写 WebDAV 同步逻辑。
2. 组件中直接拼接云端文件名并上传下载。
3. 组件中直接绑定大量全局事件但无清理。

### 3.2 Service 层要求

1. 文件读写统一收口到 repository/service。
2. 格式差异通过 adapter 或 format 分支处理。
3. 进度保存走统一 saveReaderProgress 语义，不重复造轮子。

### 3.3 Store 层要求

1. 使用明确接口定义状态结构。
2. 外部只通过 typed action 修改状态。
3. 允许 Partial<T>，但禁止无边界 any。

## 4. 事件与协议规范

1. 窗口事件统一使用 src/constants/events.ts 中的 WINDOW_EVENTS。
2. 同步字段统一遵守 schemaVersion/source/deviceId/updatedAt 语义。
3. 兼容映射（legacySync）必须在读取链路做归一化，避免回退覆盖。

## 5. 书籍格式扩展规范

新增格式（如 pdf/mobi）时按以下步骤：

1. 在 bookFormat 定义格式枚举与扩展名映射。
2. 在 services/book/parsers 新增元数据解析器。
3. 在 services/reader/adapters 新增渲染适配器。
4. 在 readerLoadService/bookRepository 打通读取流程。
5. 在进度服务定义 locationFormat 与 progress 计算方式。
6. 验证 WebDAV 同步与本地回读兼容。

## 6. 生命周期与资源释放规范

1. 任何 addEventListener 都必须有 removeEventListener 对应清理。
2. 动态 createApp 挂载组件时，关闭路径必须 unmount。
3. beforeunload 中统一回收入口绑定与临时 UI 资源。

## 7. 命名与类型规范

1. 文件命名：
- service 以 xxxService.ts 结尾。
- adapter 以 xxxAdapter.ts 结尾。
- parser 以 xxxParser.ts 结尾。

2. 类型命名：
- 领域对象使用明确 interface/type。
- 动态 key 操作必须用联合类型（keyof 或显式 union）。

3. 导入路径：
- 优先使用别名路径 @/。
- 避免跨层级相对路径穿透。

## 8. 变更提交流程（每次开发必须执行）

1. 先确认变更属于哪一层（component/composable/store/service/command）。
2. 若出现跨层调用，优先抽 service 再接入 UI。
3. 修改后至少执行：
- npm run build
- 必要时 cargo check --manifest-path src-tauri/Cargo.toml
4. 验证通过后再提交，禁止带红线提交。

## 9. 回归清单（最小）

1. EPUB：导入、打开、翻页、目录、书签、进度恢复。
2. TXT：导入、滚动翻页、进度保存恢复。
3. 窗口：标题栏按钮、样式菜单、帮助/AI/关于事件。
4. 同步：本地与云端往返后进度不回退。
