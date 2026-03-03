import { createOpenIMCore, type OpenIMClient } from '@saibotianlong/openim-core'

export interface WidgetConfig {
  apiAddr: string
  wsAddr: string
  platformID: number
  logLevel: number
  baseURL: string
  platformKey: string
}

const defaultConfig: WidgetConfig = {
  apiAddr: 'http://192.168.10.231:10002',
  wsAddr: 'ws://192.168.10.231:10001',
  platformID: 5, // Web
  logLevel: 2, // Error (0-Panic, 1-Fatal, 2-Error, 3-Warn, 4-Info, 5-Debug, 6-Verbose)
  baseURL: 'http://127.0.0.1:5153',
  platformKey: 'pk_b15ad941fcc248cab64513cebeee6d1a',
}

let currentConfig: WidgetConfig = { ...defaultConfig }
let coreInstance: OpenIMClient | null = null

export function configureWidget(config: Partial<WidgetConfig>): void {
  currentConfig = { ...currentConfig, ...config }
  if (coreInstance) {
    coreInstance.destroy()
    coreInstance = null
  }
}

export function getConfig(): WidgetConfig {
  return currentConfig
}

/** 获取共享的 OpenIM 核心客户端实例（延迟创建） */
export function getCore(): OpenIMClient {
  if (!coreInstance) {
    coreInstance = createOpenIMCore({
      apiAddr: currentConfig.apiAddr,
      wsAddr: currentConfig.wsAddr,
      platformID: currentConfig.platformID,
      logLevel: currentConfig.logLevel,
      baseURL: currentConfig.baseURL,
      platformKey: currentConfig.platformKey,
    })
  }
  return coreInstance
}
