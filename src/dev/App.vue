<script setup lang="ts">
import { ref } from 'vue'
import CustomerServiceWidget from '../CustomerServiceWidget.vue'
import { configureWidget } from '../config'

configureWidget({
  apiAddr: 'http://localhost:10002',
  wsAddr: 'ws://localhost:10001',
  baseURL: 'http://localhost:5153',
  platformKey: 'test-platform-key',
  logLevel: 5,
})

const showChat = ref(false)
</script>

<template>
  <div style="padding: 40px; font-family: sans-serif;">
    <h1>SbAgentHub Widget Dev</h1>
    <p>点击右下角按钮打开客服窗口</p>
    <p>
      <button @click="showChat = !showChat">
        {{ showChat ? '关闭' : '打开' }}客服窗口
      </button>
    </p>

    <CustomerServiceWidget
      v-model:show="showChat"
      platform-key="test-platform-key"
      user-id="test-user-001"
      nickname="测试用户"
    />
  </div>
</template>
