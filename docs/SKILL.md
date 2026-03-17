---
name: docs
description: "Use when: 在 T-Reader 中进行二次开发、重构、修复或新增功能，并需要遵循项目解耦分层规范（components/composables/store/services/constants/tauri command）。关键词：模块规范、职责划分、避免耦合、按架构改造、格式扩展、事件常量化、生命周期清理。"
---

# T-Reader Architecture Dev Skill

## 目标

让模型在实现需求时默认遵循项目当前的解耦架构，避免把旧风格耦合逻辑重新引入。
同时，涉及图标时默认遵循集中化图标管理方案，避免再次出现 SVG 调用方式分散。

规范依据：docs/module-architecture-spec.md
图标规范依据：docs/icon-management-spec.md

## 适用范围

1. 新增功能时确定放在哪一层。
2. 重构旧代码时做职责下沉和边界收口。
3. 扩展新书籍格式（例如 PDF/MOBI）。
4. 修复事件监听、窗口通信、同步回读问题。
5. SVG 图标治理与迁移（内联 svg、img svg、局部映射统一收敛到注册表）。

## 非适用范围

1. 纯样式微调且不涉及结构变化。
2. 文案改动与静态资源替换。
3. 与当前架构无关的实验性脚本。
4. 纯品牌位图资源替换（png/jpg）且不涉及图标调用链路。

## 执行流程

### Step 1: 识别变更层级

先判断需求属于：

1. UI 展示（components）
2. 交互复用（composables）
3. 状态管理（store）
4. 业务逻辑（services）
5. 事件常量（constants）
6. Tauri 命令边界（src-tauri/command）

若需求横跨多层，优先先抽 service 再接 UI。

### Step 2: 应用边界约束

执行改动时严格检查：

1. 组件中是否出现了 readFile/writeFile/invoke 直连。
2. 是否出现了窗口事件字符串散落。
3. 是否存在 addEventListener 无清理。
4. store action 是否使用 any/String 等弱类型。
5. 是否直接在业务组件中 import .svg 并用 img 渲染操作图标。
6. 是否新增内联 <svg> 且未说明必须内联的原因。

如命中任一项，必须先整改再继续功能实现。

### Step 3: 按模板落地

1. 新增业务逻辑：
- 放入 src/services/<domain>/xxxService.ts
- 对外导出纯函数或明确 API

2. 新增跨格式能力：
- 更新 src/js/bookFormat.ts
- 新增 parser/adapter
- 通过 readerLoadService 与 bookRepository 串联

3. 新增窗口事件：
- 在 src/constants/events.ts 扩展
- 使用常量替代硬编码字符串

4. 新增状态项：
- 在 store 中定义强类型接口
- 只通过 typed action 改写

5. 新增/迁移图标：
- 在 src/icons/registry.ts 注册 IconName 与资源路径
- 统一通过 src/components/common/AppIcon/index.vue 调用
- 需要动态换色/尺寸时，使用响应式 :color/:size 绑定
- 仅品牌 Logo 等多色资源允许走 image 模式

### Step 4: 生命周期闭环

若涉及以下行为，必须给出释放路径：

1. document/window 事件监听
2. 动态 createApp 挂载
3. 渲染实例与 hook 绑定

### Step 5: 验证

至少执行：

1. npm run build
2. 涉及 tauri 或 rust 模型时执行 cargo check --manifest-path src-tauri/Cargo.toml
3. 若涉及图标迁移，抽样验证暗色/亮色或激活/默认状态切换效果

若失败，先修复本次改动引入的问题再输出结果。

## 输出要求（给用户的结果）

1. 明确说明本次改动放在哪些层。
2. 列出关键文件与职责变化。
3. 给出验证结果（build/check 是否通过）。
4. 说明是否存在已知警告与风险。
5. 若有图标改动，说明新增 IconName、迁移范围与遗留待迁移清单。

## 反模式清单（禁止）

1. 在组件里直接写 WebDAV 上传下载。
2. 在任意位置硬编码窗口事件字符串。
3. 在 utils 聚合业务领域逻辑（如 EPUB 解析、同步决策）。
4. 新增监听不清理。
5. 为了省事使用 any 覆盖类型问题。
6. 在业务组件内直接维护 svgIcons 局部映射（应迁入 registry）。
7. 新增操作图标时绕过 AppIcon 直接使用 <img src="*.svg">。

## 快速检查清单

提交前逐项确认：

1. 是否遵守 docs/module-architecture-spec.md。
2. 是否没有新增跨层穿透调用。
3. 是否没有新增弱类型入口。
4. 是否完成生命周期清理。
5. 是否通过构建验证。
6. 是否遵守 docs/icon-management-spec.md。
7. 是否通过 registry + AppIcon 完成图标调用。
8. 是否没有新增内联 <svg> 与分散 svg import。
