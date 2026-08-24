export interface SystemProxyInfo {
  enabled: boolean
  source: 'environment' | 'system' | 'none'
  proxyType: string | null
  host: string | null
  port: number | null
  bypassList: string | null
  proxyUrl: string | null
}
