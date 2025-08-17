# T-Reader
该项目是使用跨平台开发框架进行开发的ePub阅读器，旨在为阅读轻小说提供最连贯流畅的体验。

## 技术栈
`Tauri` + `Vue` + `TypeScript` + `Rust`

## 项目介绍
这是一款专注于阅读日系轻小说的双端软件，文件支持ePub格式，该项目具有简约、轻便的操作界面，支持用户导入、管理、阅读书籍和书籍笔记。  
数据同步使用WebDAV协议，目前支持坚果云平台。AI功能(试行)支持智谱清言、Deepseek大模型。

## 发行
理论上Tauri框架可以构建支持Windows、Linux和Mac的安装程序，但本人懒且无人有此需求，因此目前该项目仅提供Windows系统的安装包。

移动端见另一个项目[T-Reader-Mobile](https://github.com/NameHitherto/T-Reader-Mobile.git)，其提供了安卓系统的安装包。

## 开发
该项目基于Tauri框架进行开发，因此在开始前请先查阅Tauri[官方文档](https://tauri.app/zh-cn/start/prerequisites/)确认框架所需的前置环境是否已配置完成。

### 初始准备

1. 克隆该项目到本地，在项目根目录下创建`libs`目录，项目的默认分支是*develop*。
2. 进入`[root]/libs`目录，克隆本人二次开发过的[epub.js](https://github.com/NameHitherto/epub.js.git)库。
3. 进入`[root]/libs/epub.js`目录，运行`npm install`安装epub.js项目的依赖，注意**node**版本为**v16.20.2**。
4. 回到项目根目录，运行`npm install`安装本项目的依赖，注意**node**版本为**v22.17.1**。
5. 运行`npm run tauri dev`启动项目，若无报错并生成了阅读器窗口则表示项目初始化成功。

### 可能遇到的问题

1. 若在安装依赖时遇到phantomjs库依赖下载的问题，例如：
```bash
npm ERR! command C:\Windows\system32\cmd.exe /d /s /c node install.js
npm ERR! PhantomJS not found on PATH
npm ERR! Downloading https://github.com/Medium/phantomjs/releases/download/v2.1.1/phantomjs-2.1.1-windows.zip
npm ERR! Saving to C:\Users\NAMEHI~1\AppData\Local\Temp\phantomjs\phantomjs-2.1.1-windows.zip
npm ERR! Receiving...
npm ERR! Error making request.
npm ERR! Error: read ECONNRESET
```
Windows解决方法可以是在终端中指定phantomjs的镜像下载源`$env:PHANTOMJS_CDNURL='https://npmmirror.com/mirrors/phantomjs'; npm install`。

2. 若在启动项目时遇到端口相关问题，例如：
```bash
error when starting dev server:
Error: listen EACCES: permission denied 0.0.0.0:1420
    at Server.setupListenHandle [as _listen2] (node:net:1918:21)
    at listenInCluster (node:net:1997:12)
    at node:net:2206:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```
可考虑修改服务端口，修改根目录下`[root]/vite.config.ts`中的`port`值以及修改`[root]/src-tauri/tauri.conf.json`中的`devUrl`即可。