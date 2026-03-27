# T-Reader 模块规范

本规范用于约束 `v1.0.0` 之后的代码组织、职责边界、事件契约与提交流程，目标是在保持 EPUB / TXT 主流程稳定的前提下，持续提升可维护性与可扩展性。

## 1. 设计原则

1. 单一职责：每个模块只做一件事，不在组件中混入存储、网络、解析、渲染多种职责。
2. 分层依赖：UI 只能依赖 composables / store / services，不直接依赖底层 I/O 或同步实现。
3. 格式无关：功能优先面向 `BookFormat` 抽象，不写死 `.epub` 路径或 CFI 专有逻辑。
4. 可回收生命周期：所有事件监听、DOM 绑定、窗口绑定都必须可解绑。
5. 常量契约化：窗口事件、同步字段、关键字符串统一常量定义，禁止散落字符串。
6. 发布版本优先：涉及本地目录、云端结构、核心数据模型的调整时，必须先评估数据兼容性、迁移成本与文档更新影响。

## 2. 目录职责

### 2.1 前端目录划分

1. `src/components`
- 仅承载界面与交互展示。
- 不直接堆叠复杂持久化、同步或解析逻辑。

2. `src/composables`
- 承载组件复用状态与交互逻辑。
- 允许依赖 store 与 services，不处理底层协议细节。

3. `src/store`
- 管理全局状态与最小状态变更 API。
- 保持强类型，避免 `any`、`String` 等弱类型入口。

4. `src/services`
- 承载业务逻辑与基础设施访问。
- 当前主要子域：
  - `services/book`：书籍导入、解析、仓储、缓存、展示。
  - `services/reader`：阅读加载、进度、样式、导航、事件、书签。
  - `services/fileSystem`：本地 / 云端目录访问。
  - `services/notification`：主任务通知。

5. `src/constants`
- 存放项目级常量与事件名。
- 示例：`WINDOW_EVENTS`、`fontExclusion`。

6. `src/js`
- 仅保留轻量工具与桥接初始化代码。
- 具备明确业务语义的逻辑必须迁入 `services/`。

### 2.2 Rust 侧目录划分

1. `src-tauri/src/command`
- 接收参数并组织调用，不承载难以维护的大型业务拼装。

2. `src-tauri/src/model`
- 前后端共享数据结构的 Rust 表达。
- 新字段必须考虑序列化默认值、兼容性与文档同步。

3. `src-tauri/src/logging.rs`
- 统一后端日志输出，不在各命令文件中散落重复日志格式。

## 3. 核心边界约束

### 3.1 UI 层禁止项

1. 组件中直接写 WebDAV 上传、下载、冲突判断逻辑。
2. 组件中直接拼接目录结构并操作本地文件。
3. 组件中直接绑定大量全局事件但没有清理。

### 3.2 Service 层要求

1. 文件读写统一收口到 repository / service。
2. 格式差异通过 adapter 或 format 分支处理。
3. 阅读进度统一通过 `saveReaderProgress` 语义保存。
4. 同步结果、失败原因与回退路径应尽量可记录日志。

### 3.3 Store 层要求

1. 使用明确接口定义状态结构。
2. 外部只通过明确 action 修改状态。
3. 允许 `Partial<T>`，但避免无边界 `any`。

## 4. 事件与协议规范

1. 窗口事件统一使用 `src/constants/events.ts` 中的 `WINDOW_EVENTS`。
2. 主窗口与阅读器之间统一传递 `bookKey`，避免回退到旧的 `id` 概念。
3. 阅读器样式更新、帮助、AI、书籍详情等跨窗口动作都应走事件契约。

## 5. 书籍格式扩展规范

新增格式时按以下步骤进行：

1. 在 `bookFormat` 中定义格式枚举与扩展名映射。
2. 在 `services/book/parsers` 中新增元数据解析器。
3. 在 `services/reader/adapters` 中新增渲染适配器。
4. 在 `readerLoadService` 与 `bookRepository` 中打通读取流程。
5. 在进度服务中定义 location 表达与进度计算方式。
6. 验证书架缓存、阅读恢复与 WebDAV 同步行为。

## 6. 生命周期与资源释放规范

1. 任何 `addEventListener` 都必须有对应清理。
2. 动态挂载组件或弹出层时，关闭路径必须释放资源。
3. `beforeunload` 中统一回收标题栏绑定、样式菜单与临时 UI 资源。

## 7. 命名与类型规范

1. 文件命名：
- service 以 `xxxService.ts` 结尾。
- adapter 以 `xxxAdapter.ts` 结尾。
- parser 以 `xxxParser.ts` 结尾。

2. 类型命名：
- 领域对象使用明确 `interface` / `type`。
- 动态 key 操作优先使用联合类型或 `keyof`。

3. 导入路径：
- 优先使用别名路径 `@/`。
- 避免跨层相对路径穿透。

## 8. 提交前检查

1. 先确认变更属于哪一层：component / composable / store / service / command。
2. 若出现跨层耦合，优先抽 service 再接入 UI。
3. 修改后至少执行：
- `npm run build`
- 必要时执行 `cargo check --manifest-path src-tauri/Cargo.toml`
4. 涉及核心流程、目录结构或数据模型时，同步更新文档。

## 9. 最小回归清单

1. EPUB：导入、打开、翻页、目录、书签、笔记、进度恢复。
2. TXT：导入、滚动翻页、进度保存恢复。
3. 书架：封面、格式标识、进度展示、列表 / 网格切换。
4. 窗口：标题栏按钮、样式菜单、帮助 / AI / 关于事件。
5. 同步：本地与云端往返后进度不回退。
