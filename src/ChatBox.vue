<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useOpenIM } from './composables/useOpenIM'
import { useChatAuth } from './composables/useChatAuth'
import { getCore } from './config'
import { logger, isSystemMessage as coreIsSystemMessage, MessageType } from '@saibotianlong/openim-core'
import type { Message, CustomImageData } from '@saibotianlong/openim-core'
import type { PlatformType, GetImTokenResponse } from '@saibotianlong/openim-core'
import EmojiPicker from './EmojiPicker.vue'

interface Props {
  platformKey?: string
  userId?: string
  nickname?: string
  avatar?: string
  source?: string
}

const props = withDefaults(defineProps<Props>(), {
  platformKey: '',
  userId: '',
  nickname: '',
  avatar: '',
  source: 'vue',
})

const {
  isConnected,
  isConnecting,
  messages,
  error: openIMError,
  login: loginOpenIM,
  sendText,
  sendImage,
  loadHistoryWithUser,
} = useOpenIM()

const {
  isLoggedIn,
  isLoggingIn,
  userID,
  user,
  agent,
  error: authError,
  loginSimple: loginChatAuthSimple,
  logout: logoutChatAuth,
  restoreSession,
  updateUserProfile,
} = useChatAuth()

const error = ref<string | null>(null)
watch([openIMError, authError], ([oe, ae]) => {
  error.value = ae || oe
})

const inputText = ref('')
const messageListRef = ref<HTMLDivElement | null>(null)
const isSending = ref(false)
const previewImage = ref<string | null>(null)
const showEmojiPicker = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const avatarLoadFailed = ref<Set<string>>(new Set())

const handleAvatarError = (msgId: string): void => {
  avatarLoadFailed.value.add(msgId)
}

const isAvatarFailed = (msgId: string): boolean => {
  return avatarLoadFailed.value.has(msgId)
}

const currentUserNickname = computed(() => user.value?.nickname || '访客')
const currentUserAvatar = computed(() => user.value?.avatar || '')

const getSenderInfo = (message: Message) => {
  const isSelf = isSelfMessage(message)
  if (isSelf) {
    return {
      nickname: currentUserNickname.value,
      avatar: currentUserAvatar.value,
    }
  } else {
    return {
      nickname: agent.value?.nickname || '客服',
      avatar: agent.value?.avatar || '',
    }
  }
}

const getAvatarText = (nickname: string): string => {
  return nickname ? nickname.charAt(0).toUpperCase() : '?'
}

const isSystemMsg = (message: Message): boolean => {
  return coreIsSystemMessage(message)
}

const filteredMessages = computed(() => {
  return messages.value.filter(msg => !isSystemMsg(msg))
})

const triggerImageUpload = (): void => {
  imageInputRef.value?.click()
}

/** 获取消息发送目标（群聊模式用 groupId，否则用 agentUserId） */
const getSendTarget = () => {
  const groupId = agent.value?.groupId
  if (groupId) return { recvID: groupId, isGroup: true }
  return { recvID: agent.value?.agentUserId || '', isGroup: false }
}

const handleImageSelect = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return
  if (file.size > 10 * 1024 * 1024) return

  const { recvID, isGroup } = getSendTarget()
  if (!recvID) return

  isUploading.value = true
  try {
    const core = getCore()
    const dimensions = await core.upload.getImageDimensions(file)
    const uploadResult = await core.upload.uploadFile(file)
    await sendImage(recvID, file, uploadResult.absfileName, {
      width: dimensions.width,
      height: dimensions.height,
      size: file.size,
      type: file.type,
    }, isGroup)
    scrollToBottom()
  } catch (err) {
    logger.error('ChatBox', '发送图片失败:', err)
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

const toggleEmojiPicker = (): void => {
  showEmojiPicker.value = !showEmojiPicker.value
}

const handleEmojiSelect = (emoji: string): void => {
  inputText.value += emoji
  showEmojiPicker.value = false
  nextTick(() => inputRef.value?.focus())
}

const closeEmojiPicker = (): void => {
  showEmojiPicker.value = false
}

const parseCustomImageData = (message: Message): CustomImageData | null => {
  if (Number(message.contentType) !== MessageType.CustomMessage) return null
  if (!message.customElem?.data) return null
  try {
    const data = JSON.parse(message.customElem.data) as CustomImageData
    if (data.type === 'image' && data.url) return data
  } catch { /* ignore */ }
  return null
}

const isPictureMessage = (message: Message): boolean => {
  if (Number(message.contentType) === MessageType.PictureMessage) return true
  return parseCustomImageData(message) !== null
}

const getImageUrl = (message: Message, useThumbnail: boolean = true): string => {
  if (message.pictureElem) {
    if (useThumbnail && message.pictureElem.snapshotPicture?.url) return message.pictureElem.snapshotPicture.url
    if (message.pictureElem.bigPicture?.url) return message.pictureElem.bigPicture.url
    if (message.pictureElem.sourcePicture?.url) return message.pictureElem.sourcePicture.url
  }
  const customData = parseCustomImageData(message)
  if (customData) return customData.url
  return ''
}

const openImagePreview = (message: Message): void => {
  const url = getImageUrl(message, false)
  if (url) previewImage.value = url
}

const closeImagePreview = (): void => {
  previewImage.value = null
}

const scrollToBottom = (): void => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

watch(messages, () => scrollToBottom(), { deep: true })

const handleSend = async (): Promise<void> => {
  const { recvID, isGroup } = getSendTarget()
  const text = inputText.value.trim()
  if (!text || isSending.value || !recvID) return

  isSending.value = true
  try {
    await sendText(recvID, text, isGroup)
    inputText.value = ''
    scrollToBottom()
  } catch (err) {
    logger.error('ChatBox', '发送失败:', err)
  } finally {
    isSending.value = false
  }
}

const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const isSelfMessage = (message: Message): boolean => {
  if (userID.value) return message.sendID === userID.value
  return false
}

const login = async (
  platformKey: string,
  userId?: string,
  platformType?: PlatformType
): Promise<GetImTokenResponse> => {
  return await loginChatAuthSimple(platformKey, {
    userId,
    nickname: props.nickname,
    avatar: props.avatar,
    platformType,
    source: props.source,
  })
}

const loginDirect = async (userID: string, token: string): Promise<void> => {
  return await loginOpenIM(userID, token)
}

const logout = async (): Promise<void> => {
  await logoutChatAuth()
}

defineExpose({
  login,
  loginDirect,
  logout,
  restoreSession,
  isConnected,
  isConnecting,
  isLoggedIn,
  isLoggingIn,
  userID,
  user,
  agent,
})

// props change sync
const previousProps = ref({
  userId: props.userId,
  nickname: props.nickname,
  avatar: props.avatar,
})

watch(
  [() => props.userId, () => props.nickname, () => props.avatar],
  async ([newUserId, newNickname, newAvatar], [oldUserId, oldNickname, oldAvatar]) => {
    if (newUserId === oldUserId && newNickname === oldNickname && newAvatar === oldAvatar) return
    if (!isLoggedIn.value) return

    const deviceId = user.value?.deviceId
    if (!deviceId) return

    try {
      const core = getCore()
      await core.auth.updateUserInfo(
        props.platformKey,
        deviceId,
        newUserId !== oldUserId ? newUserId : undefined,
        newNickname !== oldNickname ? newNickname : undefined,
        newAvatar !== oldAvatar ? newAvatar : undefined
      )

      if (newNickname !== oldNickname && newNickname) updateUserProfile({ nickname: newNickname })
      if (newAvatar !== oldAvatar && newAvatar) updateUserProfile({ avatar: newAvatar })

      if (agent.value?.agentUserId) {
        const updates: Record<string, string> = {}
        const previousValues: Record<string, string> = {}

        if (newUserId !== oldUserId && newUserId) {
          updates.userId = newUserId
          if (oldUserId) previousValues.userId = oldUserId
        }
        if (newNickname !== oldNickname && newNickname) {
          updates.nickname = newNickname
          if (oldNickname) previousValues.nickname = oldNickname
        }
        if (newAvatar !== oldAvatar && newAvatar) {
          updates.avatar = newAvatar
          if (oldAvatar) previousValues.avatar = oldAvatar
        }

        await core.message.sendUserInfoUpdated(
          agent.value.agentUserId,
          updates,
          Object.keys(previousValues).length > 0 ? previousValues : undefined
        )
      }

      previousProps.value = { userId: newUserId, nickname: newNickname, avatar: newAvatar }
    } catch (err) {
      logger.error('ChatBox', '用户信息更新失败:', err)
      error.value = '信息更新失败，请稍后重试'
      setTimeout(() => {
        if (error.value === '信息更新失败，请稍后重试') error.value = null
      }, 3000)
    }
  },
  { deep: true }
)

// --- 访客下线通知 ---
const loginTime = ref(0)
let boundBeforeUnload: (() => void) | null = null

const sendOfflineNotification = (reason: 'window_close' | 'idle_timeout' | 'network_error' | 'manual'): void => {
  const agentUserId = agent.value?.agentUserId
  const vid = userID.value
  if (!agentUserId || !vid) return

  const sessionDuration = loginTime.value > 0
    ? Math.round((Date.now() - loginTime.value) / 1000)
    : undefined

  getCore().message.sendVisitorOffline(agentUserId, {
    visitorId: vid,
    reason,
    sessionDuration,
  }).catch(() => {})
}

const registerBeforeUnload = (): void => {
  if (typeof window === 'undefined') return
  removeBeforeUnload()
  boundBeforeUnload = () => sendOfflineNotification('window_close')
  window.addEventListener('beforeunload', boundBeforeUnload)
}

const removeBeforeUnload = (): void => {
  if (boundBeforeUnload && typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', boundBeforeUnload)
    boundBeforeUnload = null
  }
}

/** 等待 SDK 数据同步完成，必须在 core.login() 之前调用以避免竞态 */
const waitForSync = (): Promise<void> => {
  return new Promise((resolve) => {
    const core = getCore()
    const cleanup = () => {
      clearTimeout(timer)
      core.off('sync:finished', onFinished)
      core.off('sync:failed', onFailed)
    }
    const onFinished = () => { cleanup(); resolve() }
    const onFailed = () => { cleanup(); resolve() }
    const timer = setTimeout(() => { cleanup(); resolve() }, 15000)
    core.on('sync:finished', onFinished)
    core.on('sync:failed', onFailed)
  })
}

const connectAndLogin = async (): Promise<void> => {
  if (!props.platformKey) return

  error.value = null

  // 清除旧会话，始终全新登录（与 ChatPage 保持一致）
  getCore().session.clearAuthData()

  // 在 login 之前注册 sync 监听，避免竞态条件
  const syncReady = waitForSync()

  let loginSuccess = false
  try {
    await login(props.platformKey, props.userId)
    loginSuccess = true
  } catch (e) {
    logger.error('ChatBox', '登录失败:', e)
  }

  // 等待 SDK 数据同步完成后再发送消息
  if (loginSuccess) {
    await syncReady
  }

  if (loginSuccess && agent.value?.agentUserId) {
    try {
      // 群聊模式用 groupId + sessionType=3，否则用 agentUserId（单聊）
      const groupId = agent.value?.groupId
      if (groupId) {
        await loadHistoryWithUser(groupId, 100, 3)
      } else {
        await loadHistoryWithUser(agent.value.agentUserId, 100)
      }
      scrollToBottom()
    } catch (e) {
      logger.error('ChatBox', '加载历史消息失败:', e)
    }

    loginTime.value = Date.now()

    try {
      await getCore().message.sendVisitorOnline(agent.value.agentUserId, {
        visitorId: userID.value || '',
        deviceId: user.value?.deviceId || '',
        nickname: user.value?.nickname || '访客',
        avatar: user.value?.avatar || '',
        isAnonymous: user.value?.userType === 0,
        userType: (user.value?.userType ?? 0) as 0 | 1 | 2,
        source: props.platformKey,
        platformType: 0,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        pageTitle: typeof document !== 'undefined' ? document.title : undefined,
        referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : undefined,
      })
    } catch (e) {
      logger.error('ChatBox', '发送上线通知失败:', e)
    }

    registerBeforeUnload()
  }
}

onMounted(async () => {
  scrollToBottom()
  await connectAndLogin()
})

onBeforeUnmount(() => {
  sendOfflineNotification('manual')
  removeBeforeUnload()
})
</script>

<template>
  <div class="chat-box">
    <div v-if="isConnecting || isLoggingIn" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span class="loading-text">正在连接服务器...</span>
    </div>

    <div v-else-if="error || !isConnected" class="loading-overlay">
      <div class="error-icon">!</div>
      <span class="loading-text">连接失败，请检查网络后重试</span>
      <button class="reconnect-btn" @click="connectAndLogin">重新连接</button>
    </div>

    <div ref="messageListRef" class="message-list">
      <div v-if="filteredMessages.length === 0" class="empty-messages">
        <p>暂无消息</p>
        <p class="empty-hint">发送消息开始对话</p>
      </div>

      <div
        v-for="msg in filteredMessages"
        :key="msg.clientMsgID"
        class="message-item"
        :class="{ 'is-self': isSelfMessage(msg) }"
      >
        <div class="message-header">
          <div class="message-avatar" :class="{ 'avatar-self': isSelfMessage(msg) }">
            <template v-if="isSelfMessage(msg)">
              <img
                v-if="currentUserAvatar && !isAvatarFailed(msg.clientMsgID)"
                :src="currentUserAvatar"
                :alt="currentUserNickname"
                class="avatar-img"
                @error="handleAvatarError(msg.clientMsgID)"
              />
              <div v-else class="avatar-default">{{ getAvatarText(currentUserNickname) }}</div>
            </template>
            <template v-else>
              <img
                v-if="getSenderInfo(msg).avatar && !isAvatarFailed(msg.clientMsgID)"
                :src="getSenderInfo(msg).avatar"
                :alt="getSenderInfo(msg).nickname"
                class="avatar-img"
                @error="handleAvatarError(msg.clientMsgID)"
              />
              <div v-else class="avatar-default">{{ getAvatarText(getSenderInfo(msg).nickname) }}</div>
            </template>
          </div>
          <div class="message-nickname">
            {{ isSelfMessage(msg) ? currentUserNickname : getSenderInfo(msg).nickname }}
          </div>
        </div>

        <div class="message-bubble-row">
          <div v-if="isPictureMessage(msg)" class="message-bubble message-image">
            <img
              :src="getImageUrl(msg)"
              class="chat-image"
              referrerpolicy="no-referrer"
              @click="openImagePreview(msg)"
              @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <span v-if="!getImageUrl(msg)" class="image-error">[图片加载失败]</span>
          </div>
          <div v-else class="message-bubble">
            {{ msg.textElem?.content || msg.content || '[未知消息类型]' }}
          </div>
        </div>

        <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
      </div>
    </div>

    <div v-if="previewImage" class="image-preview-overlay" @click="closeImagePreview">
      <div class="image-preview-container">
        <img :src="previewImage" class="preview-image" @click.stop />
        <button class="close-preview-btn" @click="closeImagePreview">&times;</button>
      </div>
    </div>

    <div class="input-area-wrapper">
      <EmojiPicker :visible="showEmojiPicker" @select="handleEmojiSelect" @close="closeEmojiPicker" />

      <div class="input-area">
        <button class="tool-btn" :class="{ active: showEmojiPicker }" :disabled="!isConnected" @click="toggleEmojiPicker" title="表情">
          &#x1F600;
        </button>

        <button class="tool-btn" :disabled="!isConnected || isUploading" @click="triggerImageUpload" title="发送图片">
          &#x1F5BC;
        </button>

        <input
          ref="imageInputRef"
          type="file"
          accept="image/*"
          class="hidden-input"
          @change="handleImageSelect"
        />

        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          class="message-input"
          placeholder="请输入消息..."
          :disabled="!isConnected || isSending"
          @keydown="handleKeydown"
          @focus="closeEmojiPicker"
        />
        <button
          class="send-btn"
          :disabled="!inputText.trim() || !isConnected || isSending"
          @click="handleSend"
        >
          {{ isSending ? '发送中' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-box {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f7fb;
}

.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(245, 247, 251, 0.98);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 10;
}

.loading-spinner {
  width: 36px; height: 36px;
  border: 3px solid #e8e8e8;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text { font-size: 14px; color: #666; }

.error-icon {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: #ff4d4f;
  color: white;
  font-size: 24px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}

.reconnect-btn {
  margin-top: 4px;
  padding: 8px 24px;
  border: none; border-radius: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; font-size: 14px;
  cursor: pointer; transition: opacity 0.2s;
}
.reconnect-btn:hover { opacity: 0.9; }

@keyframes spin { to { transform: rotate(360deg); } }

.message-list { flex: 1; overflow-y: auto; padding: 16px; }

.empty-messages { text-align: center; color: #999; padding-top: 60px; }
.empty-messages p { margin: 8px 0; }
.empty-hint { font-size: 12px; }

.message-item {
  display: flex; flex-direction: column;
  margin-bottom: 16px; align-items: flex-start;
}
.message-item.is-self { align-items: flex-end; }

.message-header {
  display: flex; align-items: center;
  gap: 8px; margin-bottom: 6px;
}
.message-item.is-self .message-header { flex-direction: row-reverse; }

.message-avatar {
  width: 28px; height: 28px;
  border-radius: 50%; flex-shrink: 0;
  overflow: hidden; background: #e8e8e8;
  display: flex; align-items: center; justify-content: center;
}
.message-avatar.avatar-self {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.avatar-default {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: white; background: #999;
}
.avatar-self .avatar-default { background: transparent; }

.message-nickname { font-size: 12px; color: #666; }

.message-bubble-row { width: 100%; display: flex; }
.message-item.is-self .message-bubble-row { justify-content: flex-end; }

.message-bubble {
  padding: 10px 14px; border-radius: 12px;
  background: white; color: #333;
  word-wrap: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  max-width: 85%;
}
.message-item.is-self .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message-time { font-size: 11px; color: #999; margin-top: 4px; padding: 0 4px; }
.message-item.is-self .message-time { text-align: right; align-self: flex-end; }

.input-area-wrapper {
  position: relative; background: white;
  border-top: 1px solid #e8e8e8;
}

.input-area {
  display: flex; align-items: center;
  gap: 6px; padding: 10px;
  box-sizing: border-box; width: 100%;
}

.tool-btn {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: #999; cursor: pointer;
  border-radius: 50%; transition: all 0.2s;
  flex-shrink: 0; font-size: 18px;
}
.tool-btn:hover:not(:disabled) { background: #f5f5f5; color: #667eea; }
.tool-btn.active { background: #f5f5f5; color: #667eea; }
.tool-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.hidden-input { display: none; }

.message-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e8e8e8;
  border-radius: 20px;
  font-size: 14px; outline: none;
  transition: border-color 0.2s;
  background-color: #fff; color: #333;
}
.message-input:focus { border-color: #667eea; }
.message-input:disabled { background: #f5f5f5; cursor: not-allowed; }

.send-btn {
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; border: none; border-radius: 20px;
  font-size: 14px; cursor: pointer;
  transition: opacity 0.2s; white-space: nowrap; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { opacity: 0.9; }
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.message-image { padding: 4px; background: transparent !important; box-shadow: none; }
.message-item.is-self .message-image { background: transparent !important; }

.chat-image {
  max-width: 200px; max-height: 200px;
  border-radius: 8px; cursor: pointer;
  transition: transform 0.2s; object-fit: contain;
}
.chat-image:hover { transform: scale(1.02); }

.image-error {
  color: #999; font-size: 12px; padding: 20px;
  display: block; background: #f5f5f5; border-radius: 8px;
}

.image-preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.image-preview-container { position: relative; max-width: 90vw; max-height: 90vh; }

.preview-image { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 4px; }

.close-preview-btn {
  position: absolute; top: -40px; right: -40px;
  width: 36px; height: 36px;
  border: none; background: rgba(255, 255, 255, 0.2);
  color: white; font-size: 24px; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
}
.close-preview-btn:hover { background: rgba(255, 255, 255, 0.3); }

@media (max-width: 480px) {
  .input-area { gap: 4px; padding: 8px; }
  .tool-btn { width: 32px; height: 32px; }
  .message-input { padding: 8px 12px; font-size: 16px; }
  .send-btn { padding: 8px 12px; font-size: 14px; }
}
</style>
