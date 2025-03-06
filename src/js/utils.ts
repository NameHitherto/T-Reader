import ePub from 'libs/epub.js';
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import JSZip from 'jszip';
// 生成36位随机ID
const generateID = (randomLength: number) => {
  let idStr = Date.now().toString(36);
  idStr += Math.random().toString(36).substr(2, randomLength);
  return idStr;
}
// 格式化时间 xxxx-xx-xx xx:xx
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
// 将格式化的时间转换成可比较的数值
const formatDateToNumber = (date: string) => {
  // xxxx-xx-xx xx:xx
  const dateArr = date.split(' ');
  const [year, month, day] = dateArr[0].split('-');
  const [hours, minutes] = dateArr[1].split(':');
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime();
}
// 将blob格式的图片数据转化为可持久化保存的base64格式
const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
  // 使用fetch获取Blob数据
  const response = await fetch(blobUrl)
  const blob = await response.blob()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64Data = reader.result as string
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 从EPUB书籍中提取纯文本内容
 * @param bookName epub文件名
 * @returns 包含书籍章节内容的纯文本字符串
 */
const extractEpubContent = async (bookName: string): Promise<string> => {
  // 获取EPUB文件数据
  const bookData = await readFile(`T-Reader/${bookName}.epub`, {
    baseDir: BaseDirectory.Document,
  })
  const book = ePub(bookData.buffer)
  await book.ready
  let fullText = ''
  // 解压EPUB文件
  const zip = new JSZip()
  const zipData = await zip.loadAsync(bookData.buffer);
  // 获取书籍章节
  const navigation = book.navigation
  const toc = navigation.toc
  const parser = new DOMParser()
  for (const item of toc) {
    const chapterHref = item.href
    let filePath = ''
    // 解压EPUB文件并获取当前章节的xhtml文档
    try {
      if (zipData.folder('OEBPS')) {
        filePath = `OEBPS/${chapterHref}`
      } else {
        console.error('未找到OEBPS文件夹')
      }
      // 获取文件内容
      const chapterContent = await zipData.file(filePath)?.async('string');
      if (chapterContent) {
        // 解析HTML/XHTML内容
        const htmlDoc = parser.parseFromString(chapterContent, 'text/html');
        // 提取文本内容
        const textContent = htmlDoc.body.textContent;
        // 清理文本
        const cleanText = textContent?.replace(/\s+/g, ' ').trim();
        // 拼接文本
        fullText += cleanText + '\n\n';
      }
    }catch(e) {
      console.error(e)
    }
  }
  // 后续可以继续处理文本信息，例如限制最大字符数。
  fullText = fullText.substring(0, 10000) // 当前限制最大字符数为10000
  return fullText
}

export { generateID, formatDate, formatDateToNumber, convertBlobToBase64, extractEpubContent };