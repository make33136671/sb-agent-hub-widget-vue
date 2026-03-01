<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import ChatBox from './ChatBox.vue'
import { getConfig } from './config'
import type { PlatformType, GetImTokenResponse } from '@saibotianlong/openim-core'

interface Props {
  show?: boolean
  platformKey?: string
  userId?: string
  nickname?: string
  avatar?: string
  fullPageUrl?: string
  showExpandButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: undefined,
  platformKey: '',
  userId: '',
  nickname: '',
  avatar: '',
  fullPageUrl: '',
  showExpandButton: true,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  expand: [params: { platformKey: string; userId: string }]
}>()

interface ChatBoxExposed {
  login: (platformKey: string, userId?: string, platformType?: PlatformType) => Promise<GetImTokenResponse>
  loginDirect: (userID: string, token: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<boolean>
  isConnected: boolean
  isConnecting: boolean
  isLoggedIn: boolean
  isLoggingIn: boolean
  userID: string | null
  agentUserID: string | null
}

const internalShow = ref(false)
const chatBoxRef = ref<InstanceType<typeof ChatBox> & ChatBoxExposed | null>(null)

const visible = computed({
  get: () => props.show !== undefined ? props.show : internalShow.value,
  set: (val: boolean) => {
    internalShow.value = val
    emit('update:show', val)
  },
})

const canExpand = computed(() => props.showExpandButton && props.fullPageUrl)

const connectionColor = computed(() => {
  const box = chatBoxRef.value
  if (!box) return '#ef4444'
  if (box.isConnecting || box.isLoggingIn) return '#f59e0b'
  if (box.isConnected && box.isLoggedIn) return '#22c55e'
  return '#ef4444'
})

const effectivePlatformKey = computed(() => props.platformKey || getConfig().platformKey)

const toggleChat = (): void => {
  visible.value = !visible.value
}

const openFullPage = (): void => {
  const pk = effectivePlatformKey.value
  emit('expand', { platformKey: pk, userId: props.userId })

  if (props.fullPageUrl) {
    const url = new URL(props.fullPageUrl, window.location.origin)
    if (pk) url.searchParams.set('platformKey', pk)
    if (props.userId) url.searchParams.set('userId', props.userId)
    window.location.href = url.toString()
  }
}

watch(visible, async (open) => {
  if (open && chatBoxRef.value) {
    const pk = effectivePlatformKey.value
    if (pk) {
      try {
        const restored = await chatBoxRef.value.restoreSession()
        if (!restored) {
          await chatBoxRef.value.login(pk, props.userId)
        }
      } catch (err) {
        console.error('登录失败:', err)
      }
    }
  }
})

defineExpose({
  login: (...args: Parameters<ChatBoxExposed['login']>) => chatBoxRef.value?.login(...args),
  logout: () => chatBoxRef.value?.logout(),
  restoreSession: () => chatBoxRef.value?.restoreSession(),
  open: () => { visible.value = true },
  close: () => { visible.value = false },
  toggle: () => { visible.value = !visible.value },
  isConnected: computed(() => chatBoxRef.value?.isConnected ?? false),
  isLoggedIn: computed(() => chatBoxRef.value?.isLoggedIn ?? false),
})
</script>

<template>
  <div class="cs-widget">
    <div v-if="visible" class="cs-window">
      <div class="cs-header">
        <span>在线客服<span class="cs-status-dot" :style="{ background: connectionColor, boxShadow: '0 0 6px ' + connectionColor }"></span></span>
        <div class="cs-header-actions">
          <button v-if="canExpand" class="cs-expand" @click="openFullPage" title="在新页面打开">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="cs-close" @click="toggleChat">&times;</button>
        </div>
      </div>
      <div class="cs-body">
        <ChatBox
          ref="chatBoxRef"
          :platform-key="effectivePlatformKey"
          :user-id="userId"
          :nickname="nickname"
          :avatar="avatar"
        />
      </div>
    </div>

    <button class="cs-fab" @click="toggleChat" :class="{ 'is-open': visible }">
      <svg v-if="!visible" class="cs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 14.17 2.74 16.17 4 17.74V22L8.26 20C9.42 20.32 10.68 20.5 12 20.5C17.52 20.5 22 16.02 22 10.5C22 5.81 17.52 2 12 2Z" fill="currentColor"/>
        <circle cx="8" cy="12" r="1.5" fill="white"/>
        <circle cx="12" cy="12" r="1.5" fill="white"/>
        <circle cx="16" cy="12" r="1.5" fill="white"/>
      </svg>
      <svg v-else class="cs-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.cs-widget {
  position: fixed;
  bottom: 24px; right: 24px;
  z-index: 9999;
}

@media (max-width: 480px) {
  .cs-widget { bottom: 16px; right: 16px; }
}

.cs-fab {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}
.cs-fab:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5); }
.cs-fab.is-open { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }

.cs-icon { width: 28px; height: 28px; color: white; }

.cs-window {
  position: fixed;
  bottom: 100px; right: 24px;
  width: calc(100vw - 48px);
  max-width: 400px;
  height: calc(100vh - 150px);
  max-height: 500px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease;
  box-sizing: border-box;
}

@media (max-width: 480px) {
  .cs-window {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    width: 100%; max-width: none;
    height: 100%; max-height: none;
    border-radius: 0;
  }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.cs-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  display: flex; justify-content: space-between; align-items: center;
  font-weight: 600;
}

.cs-header-actions { display: flex; align-items: center; gap: 8px; }

.cs-expand {
  background: transparent; border: none;
  color: white; cursor: pointer;
  padding: 4px; display: flex; align-items: center; justify-content: center;
  opacity: 0.8; transition: opacity 0.2s; border-radius: 4px;
}
.cs-expand:hover { opacity: 1; background: rgba(255, 255, 255, 0.1); }
.cs-expand svg { width: 18px; height: 18px; }

.cs-close {
  background: transparent; border: none;
  color: white; font-size: 24px;
  cursor: pointer; padding: 0; line-height: 1;
  opacity: 0.8; transition: opacity 0.2s;
}
.cs-close:hover { opacity: 1; }

.cs-status-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  margin-left: 8px; vertical-align: middle;
  transition: background-color 0.8s ease, box-shadow 0.8s ease;
}

.cs-body { flex: 1; overflow: hidden; background: #f5f7fb; }
</style>
