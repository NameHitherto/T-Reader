import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { parse } from '@vue/compiler-sfc'

const root = fileURLToPath(new URL('../', import.meta.url))
const clone = (value) => JSON.parse(JSON.stringify(value))

// 加载实际服务和菜单逻辑，只替换桌面 IPC、弹窗及主题渲染依赖。
function createRuntime(t) {
  let database
  const events = []
  const errors = []
  let beforeSave = async () => {}
  let failRead = false
  let savedLocalFonts = []
  const colors = (config, mode = 'light') => ({
    color: `${mode}:${config.backgroundPresets?.[mode] || 'default'}`,
    fontColor: mode === 'dark' ? '#fff' : '#000',
  })
  const mocks = {
    vue: { ...vue, onMounted: () => {} },
    'element-plus': { ElMessage: { error: (message) => errors.push(message) } },
    '@tauri-apps/plugin-dialog': { confirm: async () => true },
    '@tauri-apps/api/core': {
      convertFileSrc: (path) => `https://asset.localhost/${path}`,
      invoke: async (command, args) => {
        if (command === 'load_reader_config') {
          if (failRead) throw new Error('read failed')
          return clone(database)
        }
        if (command === 'save_reader_config') {
          await beforeSave()
          database = { ...database, ...clone(args.request) }
          events.push({ type: 'save', config: clone(database) })
          return clone(database)
        }
        if (command === 'get_local_fonts') return { fonts: clone(savedLocalFonts), warnings: [] }
        throw new Error(`Unexpected command: ${command}`)
      },
    },
    '@/services/ipc': {
      dispatchReaderStyleUpdate: async () => {
        events.push({ type: 'apply', config: clone(database) })
      },
    },
    '@/services/theme': {
      getReaderThemeCompatColors: colors,
      syncReaderConfigThemeColors: (config, mode) => ({ ...config, ...colors(config, mode) }),
      normalizeReaderBackgroundPresets: (value) => value || { light: 'default', dark: 'default' },
      getAppliedAppThemeMode: () => 'light',
      getReaderBackgroundPresetOptions: () => [],
    },
  }
  const cache = new Map()
  function load(name) {
    if (name in mocks) return mocks[name]
    if (cache.has(name)) return cache.get(name).exports
    const path = resolve(root, name.replace(/^@\//, 'src/') + (name.endsWith('.vue') ? '' : '.ts'))
    let source = readFileSync(path, 'utf8')
    if (path.endsWith('.vue')) source = parse(source).descriptor.script.content
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    const module = { exports: {} }
    cache.set(name, module)
    vm.runInNewContext(
      outputText,
      { module, exports: module.exports, require: load },
      { filename: path },
    )
    return module.exports
  }
  const config = load('@/services/reader/config')
  database = clone(config.createDefaultReaderConfig())
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  return {
    config,
    load,
    events,
    errors,
    get database() {
      return database
    },
    set beforeSave(value) {
      beforeSave = value
    },
    set failRead(value) {
      failRead = value
    },
    set savedLocalFonts(value) {
      savedLocalFonts = value
    },
    menu: () =>
      scope.run(() =>
        load('@/components/StyleMenu/index.vue').default.setup({ themeMode: 'light' }),
      ),
  }
}

test('每类菜单样式修改都先保存，再通知应用；重置保留另一主题背景', async (t) => {
  const runtime = createRuntime(t)
  const menu = runtime.menu()
  const font = makeFont()
  runtime.load('@/services/reader/localFonts').useLocalFonts().setLocalFonts([font])
  runtime.database.backgroundPresets.dark = 'pure-black'
  for (const setting of menu.settings.value) {
    const value = setting.value + setting.amount
    await menu.adjustSetting(setting.key, value)
    assert.equal(runtime.database[setting.key], value)
  }
  await menu.selectBackgroundPreset('parchment')
  await menu.switchFlow('scrolled')
  await menu.switchEpubBuiltInStylesheetMode('preserved')
  await menu.selectFont('book-font:hash.ttc:0')
  assert.equal(runtime.database.backgroundPresets.light, 'parchment')
  assert.equal(runtime.database.color, 'light:parchment')
  assert.equal(runtime.database.flow, 'scrolled')
  assert.equal(runtime.database.epubBuiltInStylesheetMode, 'preserved')
  assert.equal(runtime.database.font, 'book-font:hash.ttc:0')
  await menu.resetStyle()
  assert.equal(runtime.database.fontSize, 16)
  assert.equal(runtime.database.backgroundPresets.light, 'default')
  assert.equal(runtime.database.backgroundPresets.dark, 'pure-black')
  for (let index = 0; index < runtime.events.length; index += 2) {
    assert.equal(runtime.events[index].type, 'save')
    assert.equal(runtime.events[index + 1].type, 'apply')
    assert.deepEqual(runtime.events[index].config, runtime.events[index + 1].config)
  }
  assert.deepEqual(clone(menu.readerConfig.value), runtime.database)
  assert.equal(runtime.errors.length, 0)
})

test('连续修改与配置刷新串行执行，保存完成前不更新内存', async (t) => {
  const runtime = createRuntime(t)
  const menu = runtime.menu()
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  runtime.beforeSave = () => gate
  const first = menu.adjustSetting('fontSize', 21)
  const refresh = runtime.config.runReaderConfigTask(async () => {
    const loaded = await runtime.config.loadReaderConfigFromDisk()
    runtime.config.useReaderConfig().setReaderConfig(loaded)
  })
  const second = menu.adjustSetting('lineSpacing', 2)
  await Promise.resolve()
  assert.equal(menu.readerConfig.value.fontSize, 16)
  assert.equal(runtime.events.length, 0)
  release()
  await Promise.all([first, refresh, second])
  assert.equal(runtime.database.fontSize, 21)
  assert.equal(runtime.database.lineSpacing, 2)
  assert.deepEqual(clone(menu.readerConfig.value), runtime.database)
})

test('数据库失败不通知应用，控件恢复已保存值，后续修改仍可保存', async (t) => {
  const runtime = createRuntime(t)
  const menu = runtime.menu()
  runtime.beforeSave = async () => {
    throw new Error('write failed')
  }
  menu.flow.value = 'scrolled'
  await menu.switchFlow('scrolled')
  assert.equal(menu.flow.value, 'paginated')
  assert.equal(runtime.database.flow, 'paginated')
  assert.equal(runtime.events.length, 0)
  assert.equal(runtime.errors.length, 1)
  runtime.beforeSave = async () => {}
  runtime.failRead = true
  await menu.adjustSetting('fontSize', 25)
  assert.equal(runtime.events.length, 0)
  runtime.failRead = false
  await menu.adjustSetting('fontSize', 23)
  assert.equal(runtime.database.fontSize, 23)
})

function makeFont(faceIndex = 0) {
  return {
    filename: 'hash.ttc',
    path: 'fonts/hash.ttc',
    family: 'Example',
    displayFamily: 'Example',
    fullName: 'Example Regular',
    postscriptName: 'Example-Regular',
    subfamily: 'Regular',
    weight: 400,
    faceIndex,
    familyAliases: ['示例字体'],
  }
}

test('系统字体名称与内置字体重名时仍保留所选来源', (t) => {
  const runtime = createRuntime(t)
  const font = makeFont()
  const system = { ...font, path: 'C:/Windows/Fonts/example.ttf' }
  const { normalizeReaderConfig } = runtime.load('@/services/reader/systemFonts')
  const { buildReaderFontApplication } = runtime.load('@/services/reader/fontApplication')
  for (const value of [font.postscriptName, font.fullName, font.family, '示例字体']) {
    const normalized = normalizeReaderConfig(
      { font: value, enabledSystemFonts: [system] },
      [system],
      [font],
    )
    assert.equal(normalized.font, 'Example-Regular')
    assert.equal(buildReaderFontApplication(value, [system], [font]).fontType, 'system')
  }
  for (const value of ['book-font:hash.ttc:0', 'hash.ttc']) {
    const normalized = normalizeReaderConfig(
      { font: value, enabledSystemFonts: [system] },
      [system],
      [font],
    )
    assert.equal(normalized.font, 'book-font:hash.ttc:0')
    assert.equal(buildReaderFontApplication(value, [system], [font]).fontType, 'book')
  }
})

test('字体集合仅列出首个字面，不把不支持的字面静默替换成另一个', (t) => {
  const runtime = createRuntime(t)
  const faces = [makeFont(0), makeFont(1)]
  const local = runtime.load('@/services/reader/localFonts')
  const { normalizeReaderConfig } = runtime.load('@/services/reader/systemFonts')
  const { buildReaderFontApplication } = runtime.load('@/services/reader/fontApplication')
  assert.deepEqual(
    clone(local.buildReaderBookFontOptions(faces)).map((font) => font.value),
    ['book-font:hash.ttc:0'],
  )
  assert.equal(local.findLocalFontMatch('book-font:hash.ttc:1', faces), null)
  assert.equal(normalizeReaderConfig({ font: 'book-font:hash.ttc:1' }, [], faces).font, 'serif')
  assert.equal(buildReaderFontApplication('book-font:hash.ttc:1', [], faces).fontType, 'default')
  assert.equal(buildReaderFontApplication('book-font:missing.ttf:0', [], faces).fontFaceRule, null)
})

test('系统字体设置使用同一保存入口，保留数据库中的阅读样式和内置字体', async (t) => {
  const runtime = createRuntime(t)
  runtime.database.fontSize = 24
  runtime.database.font = 'book-font:hash.ttc:0'
  await runtime.load('@/services/reader/systemFonts').persistEnabledSystemFonts([])
  assert.equal(runtime.database.fontSize, 24)
  assert.equal(runtime.database.font, 'book-font:hash.ttc:0')
  assert.deepEqual(
    runtime.events.map((event) => event.type),
    ['save', 'apply'],
  )
})

test('字体读取仅使用数据库，系统检测与字体扫描命令不可用时仍可加载', async (t) => {
  const runtime = createRuntime(t)
  runtime.database.enabledSystemFonts = [makeFont()]
  runtime.savedLocalFonts = [
    {
      filename: 'hash.ttf',
      family: 'Saved',
      display_family: '已保存字体',
      subfamily: 'Regular',
      full_name: 'Saved Regular',
      postscript_name: 'Saved-Regular',
      weight: 400,
      path: 'Z:/missing/fonts/hash.ttf',
      face_index: 0,
      family_aliases: [],
    },
  ]
  const systemFonts = await runtime.load('@/services/reader/systemFonts').loadEnabledSystemFonts()
  assert.equal(systemFonts[0].postscriptName, 'Example-Regular')
  const local = runtime.load('@/services/reader/localFonts').useLocalFonts()
  await local.refreshLocalFonts()
  assert.equal(local.localFonts.value[0].displayFamily, '已保存字体')
  assert.equal(local.localFonts.value[0].path, 'Z:/missing/fonts/hash.ttf')
})
