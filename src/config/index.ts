import { createRealtimeCore, type RealtimeClient } from '@sb/realtime-core'

export interface WidgetConfig {
  wsAddr?: string
  logLevel: number
  baseURL: string
  platformKey: string
}

const defaultConfig: WidgetConfig = {
  logLevel: 2,
  baseURL: 'http://127.0.0.1:5153',
  platformKey: '',
}

let currentConfig: WidgetConfig = { ...defaultConfig }
let coreInstance: RealtimeClient | null = null

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

/** 获取共享的 Realtime 核心客户端实例（延迟创建） */
export function getCore(): RealtimeClient {
  if (!coreInstance) {
    coreInstance = createRealtimeCore({
      wsAddr: currentConfig.wsAddr,
      logLevel: currentConfig.logLevel,
      baseURL: currentConfig.baseURL,
      platformKey: currentConfig.platformKey,
    })
  }
  return coreInstance
}
