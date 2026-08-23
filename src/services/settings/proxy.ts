import { invoke } from '@tauri-apps/api/core'
import type { SystemProxyInfo } from '@/types/proxy'

export const detectSystemProxy = async (): Promise<SystemProxyInfo> => {
  return invoke<SystemProxyInfo>('detect_system_proxy')
}
