import { ref } from 'vue'
import type { Ref } from 'vue'
import { getCore } from '../config'
import { isSystemMessage, logger } from '@saibotianlong/openim-core'
import type { Message, Conversation, UserInfo } from '@saibotianlong/openim-core'

export interface UseOpenIMReturn {
  isConnected: Ref<boolean>
  isConnecting: Ref<boolean>
  currentUser: Ref<UserInfo | null>
  conversations: Ref<Conversation[]>
  messages: Ref<Message[]>
  currentConversation: Ref<Conversation | null>
  error: Ref<string | null>
  unreadCount: Ref<number>

  login: (userID: string, token: string) => Promise<void>
  logout: () => Promise<void>
  loadConversations: () => Promise<void>
  loadMessages: (conversationID: string, count?: number) => Promise<void>
  loadHistoryWithUser: (userID: string, count?: number, sessionType?: number) => Promise<void>
  loadMoreMessages: () => Promise<number>
  sendText: (recvID: string, text: string, isGroup?: boolean) => Promise<Message>
  sendImage: (recvID: string, file: File, imageUrl: string, imageInfo: { width: number; height: number; size: number; type: string }, isGroup?: boolean) => Promise<Message>
  setCurrentConversation: (conversation: Conversation | null) => Promise<void>
}

const isConnected = ref(false)
const isConnecting = ref(false)
const currentUser = ref<UserInfo | null>(null)
const conversations = ref<Conversation[]>([])
const messages = ref<Message[]>([])
const currentConversation = ref<Conversation | null>(null)
const error = ref<string | null>(null)
const unreadCount = ref(0)

let eventListenersRegistered = false
let registeredCoreInstance: ReturnType<typeof getCore> | null = null

let tokenRefreshCallback: (() => Promise<void>) | null = null

export const registerTokenRefreshCallback = (cb: () => Promise<void>): void => {
  tokenRefreshCallback = cb
}

const handleNewMessage = (message: Message): void => {
  // message:received 事件已由 core 过滤掉系统消息，无需再检查
  const exists = messages.value.some((m) => m.clientMsgID === message.clientMsgID)
  if (!exists) {
    messages.value.push(message)
  }

  if (
    currentConversation.value &&
    message.conversationID === currentConversation.value.conversationID
  ) {
    getCore().conversation.markAsRead(currentConversation.value.conversationID)
  } else {
    unreadCount.value++
  }
  loadConversationsInternal()
}

const handleConnectSuccess = (): void => {
  isConnected.value = true
  isConnecting.value = false
}

const handleConnectFailed = (): void => {
  isConnected.value = false
  isConnecting.value = false
  error.value = '连接失败'
}

const handleKickedOffline = (): void => {
  isConnected.value = false
  error.value = '账号在其他设备登录'
}

const handleTokenExpired = async (): Promise<void> => {
  isConnected.value = false

  if (tokenRefreshCallback) {
    try {
      await tokenRefreshCallback()
    } catch (err) {
      logger.error('OpenIM', 'Token 自动刷新失败:', err)
      error.value = 'Token 已过期，请重新登录'
    }
  } else {
    error.value = 'Token 已过期，请重新登录'
  }
}

const loadConversationsInternal = async (): Promise<void> => {
  const core = getCore()
  conversations.value = await core.conversation.getList()
  unreadCount.value = conversations.value.reduce(
    (total, conv) => total + (conv.unreadCount || 0),
    0
  )
}

/**
 * 等待 SDK 数据同步完成（sync:finished），超时 15 秒。
 * 必须在 login() 之前调用，以避免事件被遗漏的竞态条件。
 */
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

const registerEventListeners = (): void => {
  const core = getCore()
  // core 实例变化时需要重新注册
  if (eventListenersRegistered && registeredCoreInstance === core) return
  eventListenersRegistered = true
  registeredCoreInstance = core

  core.on('message:received', handleNewMessage)
  core.on('connection:success', handleConnectSuccess)
  core.on('connection:failed', handleConnectFailed)
  core.on('kicked:offline', handleKickedOffline)
  core.on('token:expired', handleTokenExpired)
}

export function useOpenIM(): UseOpenIMReturn {
  const login = async (userID: string, token: string): Promise<void> => {
    const core = getCore()
    isConnecting.value = true
    error.value = null

    try {
      // 在 login 之前注册 sync 监听，避免竞态条件
      const syncReady = waitForSync()
      await core.login(userID, token)
      await syncReady
      currentUser.value = await core.getUserInfo()
      await loadConversations()
    } catch (err) {
      error.value = (err as Error).message || '登录失败'
      isConnected.value = false
    } finally {
      isConnecting.value = false
    }
  }

  const logout = async (): Promise<void> => {
    const core = getCore()
    await core.logout()
    isConnected.value = false
    currentUser.value = null
    conversations.value = []
    messages.value = []
    currentConversation.value = null
  }

  const loadConversations = async (): Promise<void> => {
    await loadConversationsInternal()
  }

  const loadMessages = async (conversationID: string, count: number = 20): Promise<void> => {
    const core = getCore()
    const list = await core.conversation.getHistory(conversationID, count)
    messages.value = list
      .filter(msg => !isSystemMessage(msg))
      .sort((a, b) => a.sendTime - b.sendTime)
  }

  const loadHistoryWithUser = async (userID: string, count: number = 100, sessionType: number = 1): Promise<void> => {
    const core = getCore()
    try {
      const conversation = await core.conversation.getOne(userID, sessionType)
      if (conversation) {
        currentConversation.value = conversation
        const list = await core.conversation.getHistory(conversation.conversationID, count)
        messages.value = list
          .filter(msg => {
            if (!isSystemMessage(msg)) return true
            // 过滤掉群组系统通知（contentType 1501-1599）
            const ct = Number(msg.contentType)
            if (ct >= 1501 && ct <= 1599) return false
            return false
          })
          .sort((a, b) => a.sendTime - b.sendTime)
        if (messages.value.length > 0) {
          await core.conversation.markAsRead(conversation.conversationID)
        }
      } else {
        messages.value = []
      }
    } catch (err) {
      logger.error('OpenIM', '加载历史消息失败:', err)
      messages.value = []
    }
  }

  const loadMoreMessages = async (): Promise<number> => {
    if (!currentConversation.value || messages.value.length === 0) return 0

    const core = getCore()
    const firstMsg = messages.value[0]!
    const moreMessages = await core.conversation.getHistory(
      currentConversation.value.conversationID,
      20,
      firstMsg.clientMsgID
    )

    if (moreMessages.length > 0) {
      const filteredMore = moreMessages.filter(msg => !isSystemMessage(msg))
      const sortedMore = filteredMore.sort((a, b) => a.sendTime - b.sendTime)
      messages.value = [...sortedMore, ...messages.value]
    }

    return moreMessages.length
  }

  const sendText = async (
    recvID: string,
    text: string,
    isGroup: boolean = false
  ): Promise<Message> => {
    const core = getCore()
    const message = await core.message.sendText(recvID, text, isGroup)
    messages.value.push(message)
    return message
  }

  const sendImage = async (
    recvID: string,
    file: File,
    imageUrl: string,
    imageInfo: { width: number; height: number; size: number; type: string },
    isGroup: boolean = false
  ): Promise<Message> => {
    const core = getCore()
    const message = await core.message.sendImage(recvID, file, imageUrl, imageInfo, isGroup)
    messages.value.push(message)
    return message
  }

  const setCurrentConversation = async (conversation: Conversation | null): Promise<void> => {
    currentConversation.value = conversation
    if (conversation) {
      await loadMessages(conversation.conversationID)
      if (messages.value.length > 0) {
        const core = getCore()
        await core.conversation.markAsRead(conversation.conversationID)
      }
    } else {
      messages.value = []
    }
  }

  registerEventListeners()

  return {
    isConnected,
    isConnecting,
    currentUser,
    conversations,
    messages,
    currentConversation,
    error,
    unreadCount,
    login,
    logout,
    loadConversations,
    loadMessages,
    loadHistoryWithUser,
    loadMoreMessages,
    sendText,
    sendImage,
    setCurrentConversation,
  }
}
