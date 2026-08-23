import type { ModelProviderMap } from '@/types/model'
import type { UpdateChannel } from '@/types/appUpdate'

export type AppThemeMode = 'light' | 'dark'

export interface AppSettings {
  webdavUrlRoot: string
  webdavUrlFolder: string
  webdavUrl: string
  webdavUser: string
  webdavPass: string
  webdavTimeoutSeconds: number
  modelProviders: ModelProviderMap
  themeMode: AppThemeMode
  updateChannel: UpdateChannel
  proxyEnabled: boolean
}
