import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      // importStyle: false —— 关闭按需自动引入组件样式,
      // element-plus 全量样式改由 src/styles/index.scss 显式引入,
      // 确保其永远位于 vendors/element-plus.scss 覆盖样式之前(构建产物中顺序可控)
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      libs: path.resolve(__dirname, 'libs'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  build: {
    assetsInlineLimit: 0,
    // 5. reduce chunk size warning limit to better suit Tauri's use case
    chunkSizeWarningLimit: 1500,
    // 4. 此处进行前端多页面模板的配置
    rollupOptions: {
      input: {
        main: 'index.html',
        reader: 'reader.html',
      },
    },
  },
})
