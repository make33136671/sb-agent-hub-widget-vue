<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { getCore } from './config'
import { useChatAuth } from './composables/useChatAuth'
import { useRealtime, registerTokenRefreshCallback } from './composables/useRealtime'
import { ChatUI, TextPlugin, ImagePlugin, EmojiPlugin, zhCN } from '@saiboniuma/chat-ui'
import { logger } from '@saiboniuma/realtime-core'

interface Props {
  platformKey?: string
  nickname?: string
  avatar?: string
  source?: string
}

const props = withDefaults(defineProps<Props>(), {
  platformKey: '',
  nickname: '访客',
  avatar: '',
  source: 'vue',
})

const containerRef = ref<HTMLElement | null>(null)
const statusText = ref('正在连接...')
let chatUI: ChatUI | null = null

const { loginSimple, user, agent } = useChatAuth()
const { login: loginRealtime, loadHistoryWithUser, isReconnecting, messages } = useRealtime()

const displayStatus = computed(() => {
  if (isReconnecting.value) return '连接断开，正在重连...'
  return statusText.value
})

onMounted(async () => {
  if (!containerRef.value) return

  chatUI = new ChatUI(containerRef.value, {
    locale: zhCN,
    plugins: [new TextPlugin(), new ImagePlugin(), new EmojiPlugin()],
  })

  const core = getCore()
  chatUI.bindCore(core)

  let reconnectTarget: { targetId: string; sessionType: number } | null = null
  let hasConnectedBefore = false
  core.on('connection:success', async () => {
    if (!hasConnectedBefore) {
      console.log('[ChatBox] 首次连接成功，跳过重连处理')
      hasConnectedBefore = true
      return
    }
    console.log('[ChatBox] 重连成功，开始重新加入会话组')
    const convId = core.getConversationId()
    if (convId) {
      console.log('[ChatBox] 重新加入会话组, convId:', convId)
      await core.conversation.joinConversation(convId)
    } else {
      console.warn('[ChatBox] 重连后 conversationId 为空')
    }
    if (reconnectTarget) {
      console.log('[ChatBox] 重连后重新加载历史消息, targetId:', reconnectTarget.targetId)
      await loadHistoryWithUser(reconnectTarget.targetId, 100, reconnectTarget.sessionType)
      if (chatUI && messages.value.length > 0) {
        chatUI.setMessages(messages.value)
        chatUI.scrollToBottom()
      }
    }
  })

  registerTokenRefreshCallback(async () => {
    const refreshAuthData = await loginSimple(props.platformKey || undefined, {
      nickname: props.nickname, avatar: props.avatar, source: props.source,
    })
    await loginRealtime(refreshAuthData.userID, refreshAuthData.token)
  })

  try {
    core.session.clearAuthData()
    const authData = await loginSimple(props.platformKey || undefined, {
      nickname: props.nickname, avatar: props.avatar, source: props.source,
    })

    chatUI.setUserInfo(authData.userID, authData.user.nickname, authData.user.avatar)
    chatUI.setAgentInfo(
      authData.agent.agentUserId,
      authData.agent.nickname,
      authData.agent.avatar,
    )
    if (authData.agent.conversationId) {
      core.setConversationId(authData.agent.conversationId)
    }
    if (authData.agent.groupId) {
      chatUI.setGroupId(authData.agent.groupId)
    }

    await loginRealtime(authData.userID, authData.token)

    const targetId = authData.agent.groupId || authData.agent.agentUserId
    const sessionType = authData.agent.groupId ? 3 : 1
    reconnectTarget = { targetId, sessionType }
    await loadHistoryWithUser(targetId, 100, sessionType)

    if (chatUI && messages.value.length > 0) {
      chatUI.setMessages(messages.value)
      chatUI.scrollToBottom()
    }

    const convId = core.getConversationId()
    if (convId) {
      await core.conversation.joinConversation(convId)
    }

    core.message.sendVisitorOnline(authData.agent.agentUserId, {
      visitorId: authData.userID, platformKey: props.platformKey,
    }).catch(() => {})

    statusText.value = ''
  } catch (err: any) {
    logger.error('ChatBox', '连接失败:', err)
    statusText.value = err?.message || '连接失败'
  }
})

watch(() => messages.value.length, (newLen, oldLen) => {
  console.log('[ChatBox] watch 触发, messages 长度变化:', oldLen, '->', newLen)
  if (!chatUI) {
    console.warn('[ChatBox] watch: chatUI 为 null，跳过')
    return
  }
  for (const msg of messages.value) {
    chatUI.appendMessage(msg)
  }
})

onBeforeUnmount(() => {
  const core = getCore()
  const authData = core.session.loadAuthData()
  if (authData) {
    core.message.sendVisitorOffline('', {
      visitorId: authData.userID, reason: 'page_close',
    }).catch(() => {})
  }
  chatUI?.destroy()
  chatUI = null
})
</script>

<template>
  <div class="chatbox-wrapper">
    <div ref="containerRef" class="chatbox-container" />
    <div v-if="displayStatus" class="chatbox-overlay">
      <span>{{ displayStatus }}</span>
    </div>
  </div>
</template>

<style scoped>
.chatbox-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
.chatbox-container {
  width: 100%;
  height: 100%;
}
.chatbox-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  color: #666;
  font-size: 14px;
}
</style>
