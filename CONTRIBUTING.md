# Contributing

感谢你参与 T-Reader 的开发。本文档约定项目的分支管理、提交规范、issue 处理与发版流程。请在提交代码前阅读并遵守。

## 目录

- [开发环境](#开发环境)
- [本地开发](#本地开发)
- [分支管理](#分支管理)
- [提交规范](#提交规范)
- [关联与处理 issue](#关联与处理-issue)
- [代码质量检查](#代码质量检查)
- [发版流程](#发版流程)

## 开发环境

- Rust 1.89.0 及以上
- Node.js v24（主项目）
- `libs/epub.js` 子模块使用 Node.js v16.20.2
- Tauri 官方前置环境：https://tauri.app/start/prerequisites/

## 本地开发

```bash
git clone git@github.com:NameHitherto/T-Reader.git
cd T-Reader
git submodule update --init --recursive

cd libs/epub.js
npm install
cd ../..

npm install
npm run tauri dev
```

## 分支管理

### 主干分支

| 分支 | 用途 |
| --- | --- |
| `develop` | 默认开发分支，日常集成分支 |
| `main` | 发布分支，仅存放已发布版本 |

### 特性 / 修复分支

从 `develop` 切出，命名遵循：

```text
feature/<issue号>-<描述>
fix/<issue号>-<描述>
```

无对应 issue 时使用 `<type>/<描述>`（如 `feat/some-patch-260414`、`fix/epub-render`）。

示例：`feature/2-custom-webdav`（issue #2）。

### 合并规则

- 开发完成后先 `git rebase develop`，保持历史线性，再合回 `develop`。
- 禁止直接向 `main` 提交代码；发版时由 `develop` 合入 `main`。
- 功能完整、自测通过后才能合入 `develop`。

## 提交规范

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```text
<type>(<scope>): <描述>
```

### type

| type | 含义 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复缺陷 |
| `refactor` | 重构，行为不变 |
| `style` | 样式 / 代码风格调整 |
| `perf` | 性能优化 |
| `docs` | 文档变更 |
| `test` | 测试相关 |
| `build` / `ci` | 构建 / CI 配置 |
| `chore` | 杂项 |

### scope

小写英文，指向改动模块，如 `webdav`、`setting`、`bookshelf`、`reader`、`sync`、`styles`。不易归类时可省略。

### 描述

- 使用中文，动词开头，简洁说明"做了什么"；
- 重要变更可在正文补充说明，如：

```text
fix(webdav): 按 RFC 4918 将 MKCOL 405/409/重定向视为目录已存在

对已存在的集合执行 MKCOL 时，RFC 4918 规定应返回 405，坚果云返回 409，
部分服务器返回 301/302 重定向。以上状态码现均视为期望的"目录已存在"状态。
```

### 提交示例

```text
feat(webdav): 支持自定义 WebDAV 服务器地址 (#2)
fix(styles): 修复 element-plus 组件样式覆盖不生效的问题
docs: 更新使用说明
```

> 提交信息末尾携带 `(#issue号)` 可让 GitHub 自动关联 issue。

## 关联与处理 issue

1. 新功能、缺陷、重构等先创建 issue，再开分支开发；
2. 分支名带上 issue 号：`feature/<issue号>-<描述>`；
3. 提交信息末尾携带 `(#<issue号>)`，或 PR 描述中写 `Closes #<issue号>` / `Fixes #<issue号>`，合并时自动关闭 issue；
4. 若无法自动关闭（如未走 PR 合入），实现并发布后需在 issue 中回复实现内容与版本号，再手动关闭。

## 代码质量检查

提交前请保证以下命令全部通过：

```bash
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint + Stylelint
npm run format:check # Prettier 格式检查
cargo test           # Rust 单元测试（src-tauri）
npm run build        # 完整构建（typecheck + lint + vite build）
```

格式化请使用 Prettier；样式调整尽量遵循现有 Element Plus 覆盖规范（见 `src/styles/vendors/`）。

## 发版流程

版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)，tag 形如 `vX.Y.Z`。发布说明统一维护在 `CHANGELOG.md`（[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式），release workflow 会按 tag 自动提取对应版本章节作为 Release 正文。

### 步骤

1. 更新 `CHANGELOG.md`：在 `[Unreleased]` 下方新增版本章节，将本次变更按 `Added` / `Changed` / `Fixed` 归类；feature 条目标注对应的 issue 链接；
2. 确认 `develop` 上的变更已合入 `main`；
3. 在 `main` 上执行发版脚本（自动更新 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 及 lock 文件，提交并打 tag、推送）：

```bash
npm run release -- --tag v2.0.2
```

> 默认发布分支为 `main`，可用 `--branch develop` 覆盖（不推荐）。脚本要求本地不存在同名 tag。

4. 推送 tag 后，`.github/workflows/release.yml` 自动构建并发布 Release，正文从 `CHANGELOG.md` 对应章节提取；
5. 发布完成后，在对应 issue 中注明发布版本并关闭。

## 其他约定

- 不直接向 `main` 推送代码，不修改已发布版本的 git tag；
- 涉及 `libs/epub.js` 的改动需同步确认子模块指向；
- 新增依赖、破坏性变更（Breaking）需在 CHANGELOG 中明确标注。
