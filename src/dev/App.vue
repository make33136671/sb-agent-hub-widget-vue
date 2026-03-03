<script setup lang="ts">
import { ref } from 'vue'
import CustomerServiceWidget from '../CustomerServiceWidget.vue'
import { configureWidget } from '../config'

configureWidget({
  apiAddr: 'http://192.168.10.231:10002',
  wsAddr: 'ws://192.168.10.231:10001',
  baseURL: 'http://localhost:5153',
  platformKey: 'pk_b15ad941fcc248cab64513cebeee6d1a',
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
      platform-key="pk_b15ad941fcc248cab64513cebeee6d1a"
      nickname="Vue测试用户"
    />
  </div>
</template>
