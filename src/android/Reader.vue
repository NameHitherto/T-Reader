<template>
  <div class="reader">
    <!-- EPUB 阅读器内容 -->
    <div id="epub-reader"></div>
    <!-- 手势识别区域 -->
    <div class="gesture-area">
      <div class="gesture-left" @click="prevPage"></div>
      <div class="gesture-center" @click="openMenu"></div>
      <div class="gesture-right" @click="nextPage"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { readFile, BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";
import ePub from 'epubjs';
import { invoke } from '@tauri-apps/api/core';
import { useReaderConfigStore } from '../store/readerConfigStore';
import { storeToRefs } from 'pinia';
import router from '../router/android';
import { documentDir, join } from '@tauri-apps/api/path';

export default {
  name: 'AndroidReader',
  setup() {
    // 阅读时书籍ID
    const bookIsReading = ref<string | null>(null);
    const bookIdParam = router.currentRoute.value.params.bookId;
    bookIsReading.value = Array.isArray(bookIdParam) ? bookIdParam[0] : bookIdParam;
    // 打印书籍ID
    console.log('bookIsReading:', bookIsReading.value);
    // 用于存储EPUB渲染对象
    const rendition = ref<any>(null);
    // 用于存储解除监听函数
    let unlistenStyle = ref<UnlistenFn | null>(null);
    // 正式全局变量
    const readerConfigStore = useReaderConfigStore();
    // 全局状态变量，但只能访问不能修改
    const { readerConfig } = storeToRefs(readerConfigStore);
    // 文档位置
    const DOCUMENT = async (): Promise<string> => {
      return (await join(await documentDir(), 'T-Reader')).toString();
    }

    // 加载或更新阅读器样式
    const applyReaderStyle = async () => {
      // 背景颜色
      document.body.style.backgroundColor = readerConfig.value.color;

      // 阅读器样式
      // rendition.value.themes.default({
      //   "body": {
      //     "font-family": `${readerConfig.value.font}`,
      //     "font-size": `${readerConfig.value.fontSize}px`,
      //     "font-weight": readerConfig.value.fontWeight,
      //     "padding-left": `${readerConfig.value.firstLineMargin}px !important`,
      //     "padding-right": `${readerConfig.value.lastLineMargin}px !important`,
      //     "padding-top": `${readerConfig.value.headerMargin}px !important`,
      //     "padding-bottom": `${readerConfig.value.footerMargin}px !important`,
      //   },
      //   "p": {
      //     "line-height": `${readerConfig.value.lineSpacing}em`,
      //     "margin-bottom": `${readerConfig.value.paragraphSpacing}em`,
      //     "text-indent": `${readerConfig.value.indent}em`,
      //   }
      // })
    }

    // 读取配置文件
    const loadReaderConfig = async () => {
      try {
        const configData = await readFile('T-Reader/ReaderConfig.json', { baseDir: BaseDirectory.Document });
        const configTemp = JSON.parse(new TextDecoder().decode(configData));
        readerConfigStore.setReaderConfig(configTemp);
      } catch (e) {

      }
    }

    // 保存配置文件
    const saveReaderConfig = async () => {
      await invoke('save_file', { filename: 'ReaderConfig.json', contents: JSON.stringify(readerConfig.value), directory: await DOCUMENT() });
    }

    // 保存阅读进度
    const saveReaderRendition = async () => {
      if (rendition.value && bookIsReading.value) {
        const currentLocation = rendition.value.currentLocation();
        if (currentLocation) {
          const cfi = currentLocation.start.cfi;
          // 配置文件
          let bookConfigData;
          try {
            // 尝试获取云同步配置文件
            const cloudConfigData = await invoke('webdav_get', { filename: `${bookIsReading.value}.json` });
            bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike);
            console.log('使用云同步配置文件');
          } catch (e) {
            // 获取云同步配置文件失败，使用本地配置文件
            bookConfigData = await readFile(`T-Reader/${bookIsReading.value}.json`, { baseDir: BaseDirectory.Document });
            console.log('使用本地配置文件');
          }
          const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData));
          // 覆写本地配置文件
          bookConfig.location = cfi;
          const jsonString = JSON.stringify(bookConfig);
          const jsonUint8Array = new TextEncoder().encode(jsonString);
          await invoke('save_file', { filename: `${bookIsReading.value}.json`, contents: jsonString, directory: await DOCUMENT() });
          await invoke('webdav_upload', { filename: `${bookIsReading.value}.json`, contents: Array.from(jsonUint8Array) });
        }
      };
    }

    // 监听样式调整
    listen('update-reader-style', async () => {
      await applyReaderStyle();
    }).then((fn) => {
      unlistenStyle.value = fn;
    });

    // 监听阅读器窗口关闭、刷新或导航离开页面事件

    // 加载书籍
    const loadBook = async () => {
      if (!bookIsReading.value) {
        return;
      }

      try {
        let bookConfigData;
        try {
          // 尝试获取云同步配置文件
          const cloudConfigData = await invoke('webdav_get', { filename: `${bookIsReading.value}.json` });
          bookConfigData = new Uint8Array(cloudConfigData as ArrayBufferLike);
          console.log('使用云同步配置文件');
        } catch (e) {
          // 获取云同步配置文件失败，使用本地配置文件
          bookConfigData = await readFile(`T-Reader/${bookIsReading.value}.json`, { baseDir: BaseDirectory.Document });
          console.log('使用本地配置文件');
        }
        const bookConfig = JSON.parse(new TextDecoder().decode(bookConfigData));

        let bookData;
        try {
          // 尝试读取本地书籍信息
          bookData = await readFile(`T-Reader/${bookIsReading.value}.epub`, { baseDir: BaseDirectory.Document });
          console.log('使用本地书籍信息');
        } catch (e) {
          // 读取本地书籍信息失败，尝试获取云同步文件的 EPUB 资源
          const cloudBookData = await invoke('webdav_get', { filename: `${bookIsReading.value}.epub` });
          bookData = new Uint8Array(cloudBookData as ArrayBufferLike);
          console.log('使用云同步书籍信息');

          // 将云同步文件复制到本地
          await writeFile(`T-Reader/${bookIsReading.value}.epub`, bookData, { baseDir: BaseDirectory.Document });
          console.log('云同步书籍信息已复制到本地');
        }
        const bookArrayBuffer = bookData.buffer;

        // 解析并呈现 EPUB 内容
        const ePubBook = ePub(bookArrayBuffer);

        // 清空阅读器内容
        document.getElementById('epub-reader')!.innerHTML = '';

        rendition.value = ePubBook.renderTo('epub-reader', { width: '100%', height: '100%', flow: 'paginated', allowScriptedContent: true, script: '../../src/js/android.js' });

        // 恢复阅读进度
        const savedLocation = bookConfig.location;

        if (savedLocation) {
          rendition.value.display(savedLocation);
        } else {
          rendition.value.display();
        }

        // 应用阅读器样式
        await applyReaderStyle();

      } catch (e) {
        console.log(e);
      }
    };

    // 上一章
    const prevPage = () => {
      if (rendition.value) {
        rendition.value.prev();
      }
    };

    // 下一章
    const nextPage = () => {
      if (rendition.value) {
        rendition.value.next();
      }
    };

    // 打开菜单
    const openMenu = () => {
      console.log('打开菜单');
      // 在这里添加打开菜单的逻辑
    };

    // 监听键盘方向事件
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextPage();
      }
    };


    onMounted(async () => {
      // 加载阅读器配置
      await loadReaderConfig();
      // 加载书籍
      await loadBook();
      // 监听键盘事件
      document.addEventListener('keydown', keydownHandler);
      // 监听窗口关闭、刷新或导航离开页面事件

    });

    onUnmounted(async () => {
      // 临时，后续监听页面关闭时将其代替
      await saveReaderConfig();
      // 由于rendition实例大概率已经取消挂载，因此无法保存阅读进度
      await saveReaderRendition();
    });

    return {
      nextPage,
      prevPage,
      bookIsReading,
      readerConfig,
      openMenu,
    };
  }
};
</script>

<style scoped>
#epub-reader {
  position: absolute;
  width: 100%;
  height: 100%;
}

/* 滚动条样式 */
#epub-reader :deep(.epub-container) {
  overflow-x: hidden !important;
}

#epub-reader :deep(.epub-container)::-webkit-scrollbar {
  width: 12px;
}

#epub-reader :deep(.epub-container)::-webkit-scrollbar-track {
  background: transparent;
}

#epub-reader :deep(.epub-container)::-webkit-scrollbar-thumb {
  background-color: rgb(216, 216, 216);
  /* 浅色背景 */
  border-radius: 6px;
  background-clip: content-box;
}

.gesture-area {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.gesture-area > div {
  flex: 1;
  pointer-events: auto;
}
</style>