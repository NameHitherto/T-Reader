# T-Reader 图标管理规范

## 目标

统一 SVG 图标调用方式，避免混用 `img + svg 文件`、内联 `<svg>`、局部变量映射等多种模式，支持 Vue 响应式样式（颜色、尺寸、状态）。

## 统一方案

1. 图标注册表：`src/icons/registry.ts`
- 统一维护图标名称、资源路径、渲染模式。
- 所有业务代码只引用图标名，不直接引用 `.svg` 文件路径。

2. 统一图标组件：`src/components/common/AppIcon/index.vue`
- 通过 `name` 从注册表解析图标。
- 支持响应式 props：
  - `name: IconName`
  - `size: number | string`
  - `color: string`
  - `ariaLabel: string`
- 默认使用 `mask` 渲染单色图标，可直接绑定 Vue 响应式变量实现实时颜色变化。

3. 使用规则
- 禁止在业务组件中直接 `import xxx.svg` 作为图标使用。
- 禁止新增内联 `<svg>`（特殊动画图标除外，需注释说明原因）。
- 图标调用统一写法：
  - `<AppIcon name="setting" :size="24" :color="iconColor" />`

## 渲染模式

1. `mask`（推荐）
- 使用 SVG alpha 通道渲染。
- 优点：`color` 可响应式实时变化，适合工具栏、按钮、菜单图标。

2. `image`
- 保留多色原图场景（品牌 Logo / 插画类）。
- 不建议用于需要动态换色的操作图标。

## 命名规范

- 图标名使用小驼峰：`addBook`、`listView`、`bookOpen`。
- 语义优先，避免与具体视觉绑定（例如不要使用 `blueIcon`）。

## 渐进迁移建议

1. 第一阶段（高频交互）
- 主界面 header、右键菜单、阅读器控制栏。

2. 第二阶段（次高频）
- 对话框操作按钮、书签相关入口。

3. 第三阶段（收尾）
- 清理遗留内联 SVG，统一进入注册表。

## 示例

```vue
<AppIcon
  :name="isGrid ? 'gridView' : 'listView'"
  :size="22"
  :color="isActive ? '#2563eb' : '#3f3f46'"
/>
```

上述写法可直接绑定任意响应式变量，实现实时样式变化。
