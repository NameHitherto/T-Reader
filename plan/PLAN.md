# T-Reader 阅读背景调节方案

## Summary
- 在样式菜单中新增“阅读背景”模块，提供主题感知的背景模板选择与单选纹理叠加。
- 背景选择按主题分别记忆：`light` 和 `dark` 各自保存上次所选背景与纹理，切换主题时自动恢复对应配置。
- 阅读背景作用于整个阅读窗口：透明标题栏区域、阅读正文、TXT 容器、EPUB 正文、翻页按钮、底部阅读进度指示都同步跟随。
- 交互沿用当前样式菜单的即时生效模式；重置按钮升级为“恢复默认阅读样式”，并同时重置排版与阅读背景。

## Key Changes
- 扩展阅读配置并持久化到 `ReaderConfig.json`：
  - 新增 `ReaderConfig.readingBackground`，结构固定为：
    - `light: { preset, texture }`
    - `dark: { preset, texture }`
  - `texture` 固定为单选：`'none' | 'grid' | 'paper'`
  - `preset` 使用统一字符串集合，但按主题限制可选项：
    - 白天：`'theme' | 'minimal-gray' | 'warm-yellow' | 'glass'`
    - 黑夜：`'theme' | 'ide-black' | 'eye-care-black' | 'glass'`
  - 默认值固定为：
    - `light: { preset: 'theme', texture: 'none' }`
    - `dark: { preset: 'theme', texture: 'none' }`
  - 旧版 `ReaderConfig.json` 缺少该字段时自动补默认值，不影响现有配置读取。

- 新增阅读背景解析层，不把背景模板散落在组件里：
  - 新增一个 reader 专用背景解析服务，输入为 `themeMode + readingBackground[themeMode]`，输出为当前窗口使用的背景样式方案。
  - 该解析层统一生成：
    - 窗口背景
    - 正文背景
    - 按钮/浮层表面色
    - 边框与弱强调色
    - 纹理遮罩背景图
  - `theme` 预设直接复用当前主题默认阅读配色。
  - `glass` 固定实现为“窗口内磨砂玻璃感”，不是 OS 级真透明窗口。

- 将阅读背景应用到整个阅读窗口，而不是只改正文：
  - 保持当前透明标题栏实现不改，改为把背景写到 `document.body` / `document.documentElement` 和 reader 作用域 CSS 变量上，让标题栏区域自然继承同一窗口背景。
  - `ReaderApp` 不再只用 `getAppThemePalette().readerBackground` 作为唯一背景来源，而是基于“当前主题 + 当前主题下的背景选择”解析出 active reader background scheme。
  - EPUB 路径：
    - 将解析后的背景和纹理写入 rendition theme 的 `body.background` / `background-image` 体系。
  - TXT 路径：
    - 将同一套背景和纹理写入 `#txt-reader` 与内容容器。
  - Chrome 路径：
    - `.reader`、翻页按钮、底部阅读进度指示使用同一组 reader 背景变量，保证 header/body/footer 一致。

- 在样式菜单中新增背景选择 UI，且不显示文字型选项标题：
  - 在 `StyleMenu` 顶部、字体区之前新增“阅读背景”分区。
  - 背景选项用 2x2 视觉模板卡片展示，不显示可见文字说明；仅保留 `aria-label` 这类无障碍语义。
  - 纹理选项单独一行，固定三选一：无纹理、网格、纸张。
  - 纹理同样使用视觉模板，不显示可见文字。
  - Light 模式只显示白天 4 个背景模板，Dark 模式只显示黑夜 4 个背景模板。
  - 切换背景或纹理后立即更新当前主题对应的保存值，并立即触发 `UPDATE_READER_STYLE`。
  - 主题切换后，样式菜单自动切换到该主题已保存的背景与纹理，不做跨主题映射。

- 固定纹理实现方式，避免额外素材决策：
  - `grid` 使用 CSS repeating linear gradients 生成透明网格遮罩。
  - `paper` 使用 CSS gradients 生成轻纸张/颗粒遮罩，不引入外部图片资产。
  - 纹理始终是透明叠加层，不改变预设本身的基础底色。

- 调整重置行为：
  - 将样式菜单重置按钮文案改为“恢复默认阅读样式”。
  - 点击后同时重置：
    - 排版参数
    - 翻页模式
    - `light` / `dark` 两套阅读背景选择
  - 重置后的背景默认回到各主题的 `theme + none`。

## Public Interfaces / Types
- `ReaderConfig.readingBackground`
- `type ReaderBackgroundTexture = 'none' | 'grid' | 'paper'`
- `type ReaderBackgroundPreset = 'theme' | 'minimal-gray' | 'warm-yellow' | 'glass' | 'ide-black' | 'eye-care-black'`
- `StyleMenu` 公共行为变更：
  - 新增阅读背景选择区
  - 重置按钮文案改为“恢复默认阅读样式”
  - 重置范围包含背景配置
- 阅读背景不进入 `setting.json`，仅持久化在 `ReaderConfig.json`

## Test Plan
- 构建验证：`npm run build` 通过。
- 兼容验证：旧 `ReaderConfig.json` 没有 `readingBackground` 时，启动后自动补默认值且不报错。
- 主题记忆验证：
  - 在白天模式选择任一白天背景与纹理。
  - 切到黑夜模式选择另一组黑夜背景与纹理。
  - 来回切换主题时，各自恢复本主题上次选择。
- 菜单验证：
  - 白天只出现 4 个白天背景模板。
  - 黑夜只出现 4 个黑夜背景模板。
  - 纹理固定为 `none/grid/paper` 三选一。
  - 背景与纹理选项无可见文字说明，仅保留模板视觉和选中态。
- 应用范围验证：
  - 标题栏区域视觉跟随阅读背景。
  - EPUB 正文背景正确切换。
  - TXT 阅读区域背景正确切换。
  - 翻页按钮、底部阅读进度指示与背景风格一致。
- 状态验证：
  - 修改背景后立即生效，无需关闭窗口。
  - 关闭并重新打开阅读窗口后，仍恢复对应主题下的已保存背景。
- 重置验证：
  - 点击“恢复默认阅读样式”后，排版与 `light/dark` 两套背景都恢复默认。
- 视觉验证：
  - 白天 4 套背景、黑夜 4 套背景在默认纹理和两种纹理下，文本对比度都保持可读。
  - 网格与纸张纹理仅作为透明遮罩，不破坏正文阅读。

## Assumptions
- 当前代码中的透明标题栏实现保持不变，阅读背景通过窗口根背景与 reader CSS 变量统一驱动。
- `theme` 预设始终代表当前全局主题默认阅读配色，不单独维护副本。
- `glass` 使用窗口内磨砂半透明方案，不追求 Tauri 窗口级透明穿透。
- 纹理为单选模式，不允许 `grid` 与 `paper` 叠加。
