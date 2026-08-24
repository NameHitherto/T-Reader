import type { ModelProviderMap } from '@/services/settings/modelTypes'
import type { UpdateChannel } from '@/services/settings/updateTypes'

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
