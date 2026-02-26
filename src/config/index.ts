export interface WidgetConfig {
  apiAddr: string
  wsAddr: string
  platformID: number
  logLevel: number
  baseURL: string
  platformKey: string
}

const defaultConfig: WidgetConfig = {
  apiAddr: 'http://localhost:10002',
  wsAddr: 'ws://localhost:10001',
  platformID: 5, // Web
  logLevel: 2, // Error (0-Panic, 1-Fatal, 2-Error, 3-Warn, 4-Info, 5-Debug, 6-Verbose)
  baseURL: 'http://localhost:5153',
  platformKey: '',
}

let currentConfig: WidgetConfig = { ...defaultConfig }

export function configureWidget(config: Partial<WidgetConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

export function getConfig(): WidgetConfig {
  return currentConfig
}
