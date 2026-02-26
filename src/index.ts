import type { App } from 'vue'
import type { WidgetConfig } from './types'

// 导出类型
export type { WidgetConfig, ChatMessage, UserInfo, WidgetTheme } from './types'

// 占位组件（Phase 4 实现）
export const CustomerServiceWidget = {
  name: 'CustomerServiceWidget',
  props: {
    config: {
      type: Object as () => WidgetConfig,
      required: true,
    },
  },
  setup() {
    return () => null
  },
}

// Vue 插件安装
export function install(app: App, config?: WidgetConfig) {
  app.component('CustomerServiceWidget', CustomerServiceWidget)
  if (config) {
    app.provide('widgetConfig', config)
  }
}

// 独立创建函数
export function createWidget(el: string | HTMLElement, config: WidgetConfig) {
  const { createApp } = require('vue')
  const app = createApp(CustomerServiceWidget, { config })
  const container = typeof el === 'string' ? document.querySelector(el) : el
  if (container) {
    app.mount(container)
  }
  return app
}

export default { install }
