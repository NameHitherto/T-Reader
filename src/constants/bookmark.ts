// 书签下划线使用的 className（SVG 覆盖层）。
export const BOOKMARK_UNDERLINE_CLASS = 'bookmark-underline'

export type UnderlineType = 'straight' | 'dashed' | 'dotted' | 'wavy'

export interface UnderlineStyle {
  color: string
  type: UnderlineType
  width: number
}

export const UNDERLINE_TYPES: UnderlineType[] = ['straight', 'dashed', 'dotted', 'wavy']

export const UNDERLINE_COLOR_CHOICES = [
  '#00c4b6',
  '#f44336',
  '#e91e63',
  '#9c27b0',
  '#3f51b5',
  '#2196f3',
  '#4caf50',
  '#ffeb3b',
  '#6b7280',
] as const

export const UNDERLINE_WIDTH_CHOICES = [1, 2, 3] as const

export const DEFAULT_UNDERLINE_STYLE: UnderlineStyle = {
  color: UNDERLINE_COLOR_CHOICES[UNDERLINE_COLOR_CHOICES.length - 1],
  type: 'straight',
  width: 2,
}

const UNDERLINE_STYLE_STORAGE_KEY = 't-reader:underline-style'

const isUnderlineType = (value: unknown): value is UnderlineType =>
  typeof value === 'string' && (UNDERLINE_TYPES as string[]).includes(value)

/**
 * 读取用户上次保存的下划线样式偏好，未保存时回落到默认样式。
 */
export const loadPreferredUnderlineStyle = (): UnderlineStyle => {
  try {
    const raw = localStorage.getItem(UNDERLINE_STYLE_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_UNDERLINE_STYLE }
    }

    const parsed = JSON.parse(raw) as Partial<UnderlineStyle>
    return {
      color:
        typeof parsed.color === 'string' && parsed.color
          ? parsed.color
          : DEFAULT_UNDERLINE_STYLE.color,
      type: isUnderlineType(parsed.type) ? parsed.type : DEFAULT_UNDERLINE_STYLE.type,
      width:
        typeof parsed.width === 'number' && parsed.width > 0
          ? parsed.width
          : DEFAULT_UNDERLINE_STYLE.width,
    }
  } catch {
    return { ...DEFAULT_UNDERLINE_STYLE }
  }
}

/**
 * 保存用户的下划线样式偏好。
 */
export const savePreferredUnderlineStyle = (style: UnderlineStyle): void => {
  try {
    localStorage.setItem(UNDERLINE_STYLE_STORAGE_KEY, JSON.stringify(style))
  } catch {
    // 忽略 localStorage 不可用或写满等异常
  }
}
