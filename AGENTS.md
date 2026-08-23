# T-Reader Agent Guide

## 项目定位

T-Reader 是基于 Vue 3 + TypeScript + Vite 与 Tauri 2 + Rust 的 Windows 桌面阅读器。

## 运行平台与构建边界

- **目标运行平台仅为 Windows**。
- Release CI 仅构建 `x86_64-pc-windows-msvc`，不要为 Linux、macOS 或其他 Rust target 增加发布兼容逻辑。
- Windows 专属实现可以使用 Windows API / `cfg(target_os = "windows")`；涉及跨平台代码时，优先保证 Windows 发布链路的正确性。

## 开发环境分工

项目采用双环境开发：

- **WSL2**：由 agent 负责编码、代码阅读、静态检查与前端构建检查。
- **Windows**：负责 Rust 编译验证、Tauri 打包验证以及手动运行测试。

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

## 变更后报告

完成任务时说明：

1. 修改了哪些文件及原因；
2. 在 WSL2 中实际执行了哪些检查及结果；
3. 哪些验证仍需在 Windows 上执行，尤其是 Rust 编译、Tauri 打包和手动测试。
