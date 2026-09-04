# 本地字体服务

本地字体服务把 EPUB 中提取出的字体保存到 Windows 用户文档目录下的
`Documents/T-Reader/fonts/`。字体目录是本地专用目录，不参与 WebDAV 云同步；目录不存在时，
服务会自动重新创建它。

目录保持扁平结构，文件名使用内容哈希和根据实际字体字节推断出的规范扩展名。规范扩展名取决于
文件内容，不沿用 EPUB 资源的原始扩展名：

```text
T-Reader/
└─ fonts/
   ├─ <content-hash>.ttf
   ├─ <content-hash>.otf
   ├─ <content-hash>.ttc
   └─ <content-hash>.otc
```

支持 `TTF`、`OTF`、`TTC` 和 `OTC`。`WOFF`、`WOFF2` 等不支持的格式、加密或混淆的 EPUB
字体资源、损坏或无法解析的字体会被跳过，并通过提取结果或扫描结果中的 warning 返回。单个
字体文件最大 `64 MiB`，一次 EPUB 提取中字体数据累计最大 `256 MiB`。

前端封装位于 `src/services/reader/localFonts.ts`：

- `extractEpubFonts(filename)` 的 `filename` 只能是本地 `books/` 目录中的 EPUB 文件名，不能
  传入路径。它返回一个结果数组，每个 EPUB 内部字体资源对应一个结果：

  ```ts
  {
    sourcePath: string
    filename: string | null
    fonts: LocalFontEntry[]
    status: 'extracted' | 'existing' | 'skipped' | 'failed'
    reason: string | null
  }
  ```

  `sourcePath` 是 EPUB 内部资源路径；返回的 `filename` 是字体目录中的哈希文件名，跳过或失败
  时可以为 `null`。`fonts` 是该字体文件解析出的所有 face，字段在前端使用 camelCase。

- `getLocalFonts()` 返回 `{ fonts: LocalFontEntry[], warnings: { filename: string, reason: string }[] }`。
  `fonts` 中每个 face 都带有所属字体文件的 `filename` 和后端确认过的绝对 `path`；无法读取或
  解析的字体文件会保留在 `warnings` 中。字体目录缺失时，此调用也会先创建目录。
- `deleteLocalFont(filename)` 返回 `{ deleted: boolean }`，删除成功为 `true`，文件已不存在为
  `false`；文件占用或权限错误会拒绝 Promise。
- `getLocalFontUrl(font: Pick<LocalFontEntry, 'path'>)` 同步返回该字体文件的 Tauri asset URL。

`filename` 指向字体文件而不是单独的 face。同一个字体集合中的所有 face 共享一个文件，删除
该文件会同时删除集合中的所有 face。相同内容在不同书籍之间共享同一个字体文件，删除影响所有
引用该文件的调用方，但不会修改原始 EPUB。URL 封装只定位字体文件，不提供对
TTC/OTC 集合进行任意 face 选择的能力。

调用示例（本次没有自动接入界面或阅读器设置）：

```ts
import {
  extractEpubFonts,
  getLocalFonts,
  getLocalFontUrl,
  deleteLocalFont,
} from '@/services/reader/localFonts'

const results = await extractEpubFonts('example.epub')
// 根据 status 和 reason 展示每个资源的提取结果。
const { fonts, warnings } = await getLocalFonts()
// fonts 按 filename + faceIndex 区分各字面，warnings 可用于提示损坏文件。

// 用户确认删除某个文件后：
const selectedFont = fonts[0]
if (selectedFont) {
  await deleteLocalFont(selectedFont.filename)
  const refreshed = await getLocalFonts()
}
```

无字体的 EPUB 返回空数组；输入无效、EPUB 不可读取或目标目录不可用会拒绝 Promise。
各字体条目独立处理，某条目失败不会回滚已经成功保存的字体。提取不会联网下载或安装系统字体。

对仍然存在的 TTF/OTF，可以通过 URL 创建 `FontFace`（`font` 为调用方选中的条目）：

```ts
const url = getLocalFontUrl(font)
const face = new FontFace(font.family, `url("${url}")`, {
  weight: String(font.weight ?? 400),
})

await face.load()
document.fonts.add(face)
```

使用时应以 `getLocalFonts()` 返回的 `font.path`、`font.filename` 和字体元数据为准；不要把
face 的索引拼接进文件 URL。

## 验证

在 Windows 上运行：

```powershell
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

符号链接测试默认忽略，因为 Windows 需要开发者模式或 `SeCreateSymbolicLinkPrivilege`。
具备该权限时可单独运行：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc rejects_symbolic_links_for_fonts_and_book_directories -- --ignored
```

自动测试使用临时目录和生成的字体数据，不访问用户书库。Tauri 窗口中的命令调用、真实字体
URL 加载及阅读器显示效果仍需在 Windows 应用内手动验收。
