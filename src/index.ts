import type { App } from 'vue'
import type { WidgetConfig } from './config'
import { configureWidget } from './config'
import CustomerServiceWidget from './CustomerServiceWidget.vue'

export { CustomerServiceWidget }
export { configureWidget, getConfig, getCore } from './config'
export type { WidgetConfig } from './config'
export type {
  ChatUserProfile,
  AssignedAgentInfo,
  PlatformConfigInfo,
  FeatureFlags,
  GetTokenRequest,
  GetTokenResponse,
  PlatformType,
} from '@sb/realtime-core'
export type { Message, Conversation } from '@sb/realtime-core'
export { MessageType } from '@sb/realtime-core'

export function install(app: App, config?: Partial<WidgetConfig>) {
  app.component('CustomerServiceWidget', CustomerServiceWidget)
  if (config) {
    configureWidget(config)
    app.provide('widgetConfig', config)
  }
}

export async function createWidget(el: string | HTMLElement, config: Partial<WidgetConfig>) {
  configureWidget(config)
  const { createApp } = await import('vue')
  const app = createApp(CustomerServiceWidget, {
    platformKey: config.platformKey,
  })
  const container = typeof el === 'string' ? document.querySelector(el) : el
  if (container) {
    app.mount(container)
  }
  return app
}

export default { install }
