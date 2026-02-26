import { ref } from 'vue'
import type { Ref } from 'vue'
import openIMService from '../services/openIM'
import logger from '../utils/logger'
import type { Message, Conversation, UserInfo } from '../types/openIM'
import { MessageType } from '../types/openIM'

function isSystemMessage(message: Message): boolean {
  if (Number(message.contentType) !== MessageType.CustomMessage) return false
  if (!message.customElem?.data) return false

  try {
    const data = JSON.parse(message.customElem.data)
    if (data.type === 'visitor_online' || data.type === 'visitor_offline' || data.type === 'user_info_updated') {
      return true
    }
  } catch {
    // not a custom message
  }
  return false
}

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
  loadHistoryWithUser: (userID: string, count?: number) => Promise<void>
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

let tokenRefreshCallback: (() => Promise<void>) | null = null

export const registerTokenRefreshCallback = (cb: () => Promise<void>): void => {
  tokenRefreshCallback = cb
}

const handleNewMessage = (message: Message): void => {
  if (isSystemMessage(message)) {
    return
  }

  const exists = messages.value.some((m) => m.clientMsgID === message.clientMsgID)
  if (!exists) {
    messages.value.push(message)
  }

  if (
    currentConversation.value &&
    message.conversationID === currentConversation.value.conversationID
  ) {
    openIMService.markConversationAsRead(currentConversation.value.conversationID)
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
  conversations.value = await openIMService.getConversationList()
  unreadCount.value = conversations.value.reduce(
    (total, conv) => total + (conv.unreadCount || 0),
    0
  )
}

const registerEventListeners = (): void => {
  if (eventListenersRegistered) return
  eventListenersRegistered = true

  openIMService.on('onNewMessage', handleNewMessage)
  openIMService.on('onConnectSuccess', handleConnectSuccess)
  openIMService.on('onConnectFailed', handleConnectFailed)
  openIMService.on('onKickedOffline', handleKickedOffline)
  openIMService.on('onUserTokenExpired', handleTokenExpired)
}

export function useOpenIM(): UseOpenIMReturn {
  const login = async (userID: string, token: string): Promise<void> => {
    isConnecting.value = true
    error.value = null

    try {
      await openIMService.initOpenIM(userID, token)
      isConnected.value = true
      currentUser.value = await openIMService.getSelfUserInfo()
      await loadConversations()
    } catch (err) {
      error.value = (err as Error).message || '登录失败'
      isConnected.value = false
    } finally {
      isConnecting.value = false
    }
  }

  const logout = async (): Promise<void> => {
    await openIMService.logout()
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
    const list = await openIMService.getHistoryMessages(conversationID, count)
    messages.value = list
      .filter(msg => !isSystemMessage(msg))
      .sort((a, b) => a.sendTime - b.sendTime)
  }

  const loadHistoryWithUser = async (userID: string, count: number = 100): Promise<void> => {
    try {
      const conversation = await openIMService.getConversationByUserID(userID)
      if (conversation) {
        currentConversation.value = conversation
        const list = await openIMService.getHistoryMessages(conversation.conversationID, count)
        messages.value = list
          .filter(msg => !isSystemMessage(msg))
          .sort((a, b) => a.sendTime - b.sendTime)
        if (messages.value.length > 0) {
          await openIMService.markConversationAsRead(conversation.conversationID)
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

    const firstMsg = messages.value[0]!
    const moreMessages = await openIMService.getHistoryMessages(
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
    const message = await openIMService.sendTextMessage(recvID, text, isGroup)
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
    const message = await openIMService.sendImageMessageByFile(recvID, file, imageUrl, imageInfo, isGroup)
    messages.value.push(message)
    return message
  }

  const setCurrentConversation = async (conversation: Conversation | null): Promise<void> => {
    currentConversation.value = conversation
    if (conversation) {
      await loadMessages(conversation.conversationID)
      if (messages.value.length > 0) {
        await openIMService.markConversationAsRead(conversation.conversationID)
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
