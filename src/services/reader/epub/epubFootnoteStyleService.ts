/**
 * EPUB 脚注样式生成器
 * 在禁用内置样式时为脚注元素提供默认样式
 */

/**
 * 获取脚注基础样式
 * 这些样式会在样式隔离启用时注入到 iframe 中
 */
export const getFootnoteBaseStyles = (): string => {
  return `
    /* 脚注图标 */
    img[class~="footnote"] {
      max-width: 1em !important;
    }
  `
}
