<script setup lang="ts">
import { ref, reactive } from 'vue'
import CustomerServiceWidget from '../CustomerServiceWidget.vue'
import { configureWidget } from '../config'

const STORAGE_KEY = 'sb-widget-dev-config'

const savedConfig = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

const form = reactive({
  baseURL: savedConfig?.baseURL ?? 'https://kefu.saibo.club',
  apiAddr: savedConfig?.apiAddr ?? 'https://kefu.saibo.club/imapi',
  wsAddr: savedConfig?.wsAddr ?? 'wss://kefu.saibo.club/imws',
  platformKey: savedConfig?.platformKey ?? '',
  nickname: savedConfig?.nickname ?? 'Vue测试用户',
  logLevel: savedConfig?.logLevel ?? 5,
  source: savedConfig?.source ?? 'vue',
})

const applied = ref(false)
const showChat = ref(false)
const widgetKey = ref(0)

function applyConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(form))

  showChat.value = false
  configureWidget({
    baseURL: form.baseURL,
    apiAddr: form.apiAddr,
    wsAddr: form.wsAddr,
    platformKey: form.platformKey,
    logLevel: form.logLevel,
  })
  widgetKey.value++
  applied.value = true
}

function resetConfig() {
  form.baseURL = 'https://kefu.saibo.club'
  form.apiAddr = 'https://kefu.saibo.club/imapi'
  form.wsAddr = 'wss://kefu.saibo.club/imws'
  form.platformKey = ''
  form.nickname = 'Vue测试用户'
  form.logLevel = 5
  form.source = 'vue'
  localStorage.removeItem(STORAGE_KEY)
  applied.value = false
  showChat.value = false
}

// 首次自动应用已保存的配置
if (savedConfig) {
  applyConfig()
}
</script>

<template>
  <div class="dev-page">
    <div class="dev-header">
      <h1>SbAgentHub Widget 测试</h1>
      <p class="dev-desc">配置服务端地址和平台信息，点击"应用配置"后测试 Widget 组件</p>
    </div>

    <div class="dev-config">
      <div class="config-section">
        <h3>服务端配置</h3>
        <div class="form-grid">
          <label class="form-item">
            <span class="form-label">API 基地址 (baseURL)</span>
            <input v-model="form.baseURL" placeholder="https://kefu.saibo.club" />
          </label>
          <label class="form-item">
            <span class="form-label">Realtime API 地址 (apiAddr)</span>
            <input v-model="form.apiAddr" placeholder="https://kefu.saibo.club/imapi" />
            <span class="form-hint">备用地址，服务端返回时优先使用服务端地址</span>
          </label>
          <label class="form-item">
            <span class="form-label">Realtime WS 地址 (wsAddr)</span>
            <input v-model="form.wsAddr" placeholder="wss://kefu.saibo.club/imws" />
            <span class="form-hint">备用地址，服务端返回时优先使用服务端地址</span>
          </label>
        </div>
      </div>

      <div class="config-section">
        <h3>平台配置</h3>
        <div class="form-grid">
          <label class="form-item">
            <span class="form-label">平台 Key (platformKey)</span>
            <input v-model="form.platformKey" placeholder="pk_xxxx" />
          </label>
          <label class="form-item">
            <span class="form-label">接入方式 (source)</span>
            <select v-model="form.source">
              <option value="js">JS - 脚本嵌入</option>
              <option value="vue">Vue - 组件接入</option>
              <option value="chat">Chat - 独立页面</option>
            </select>
            <span class="form-hint">需与后台平台配置的"接入方式"一致</span>
          </label>
          <label class="form-item">
            <span class="form-label">用户昵称</span>
            <input v-model="form.nickname" placeholder="测试用户" />
          </label>
          <label class="form-item">
            <span class="form-label">日志级别 (0-6)</span>
            <select v-model.number="form.logLevel">
              <option :value="0">0 - Panic</option>
              <option :value="1">1 - Fatal</option>
              <option :value="2">2 - Error</option>
              <option :value="3">3 - Warn</option>
              <option :value="4">4 - Info</option>
              <option :value="5">5 - Debug</option>
              <option :value="6">6 - Verbose</option>
            </select>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" @click="applyConfig">应用配置</button>
        <button class="btn btn-secondary" @click="resetConfig">重置</button>
      </div>
    </div>

    <template v-if="applied">
      <div class="dev-status">
        <span class="status-badge">配置已应用</span>
        <span class="status-info">
          {{ form.baseURL }} | {{ form.platformKey }} | source={{ form.source }}
        </span>
        <button class="btn btn-sm" @click="showChat = !showChat">
          {{ showChat ? '关闭' : '打开' }}客服窗口
        </button>
      </div>

      <CustomerServiceWidget
        :key="widgetKey"
        v-model:show="showChat"
        :platform-key="form.platformKey"
        :nickname="form.nickname"
        :source="form.source"
      />
    </template>
  </div>
</template>

<style scoped>
.dev-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1a1a2e;
}

.dev-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.dev-desc {
  color: #666;
  margin: 0 0 24px;
  font-size: 14px;
}

.dev-config {
  background: #f8f9fb;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
}

.config-section {
  margin-bottom: 20px;
}

.config-section h3 {
  margin: 0 0 12px;
  font-size: 15px;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.form-hint {
  font-size: 12px;
  color: #94a3b8;
}

.dev-config input,
.dev-config select {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: #fff;
  transition: border-color 0.2s;
}

.dev-config input:focus,
.dev-config select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #e2e8f0;
  color: #475569;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

.btn-sm {
  padding: 4px 14px;
  font-size: 13px;
  background: #667eea;
  color: #fff;
  border-radius: 4px;
}

.btn-sm:hover {
  opacity: 0.9;
}

.dev-status {
  margin-top: 20px;
  padding: 12px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status-badge {
  background: #22c55e;
  color: #fff;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-info {
  font-size: 13px;
  color: #64748b;
  font-family: 'SF Mono', 'Fira Code', monospace;
  flex: 1;
}
</style>
