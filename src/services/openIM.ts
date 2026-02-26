import { getSDK, CbEvents } from '@openim/wasm-client-sdk'
import { getConfig } from '../config'
import logger from '../utils/logger'
import type {
  Message,
  Conversation,
  UserInfo,
  OpenIMEventType,
  EventCallback,
} from '../types/openIM'

type IMSDK = ReturnType<typeof getSDK>

let openIM: IMSDK | null = null

function fixNullArrays(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(fixNullArrays)
  if (typeof obj === 'object') {
    const fixed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value === null && NULL_ARRAY_KEYS.has(key)) {
        fixed[key] = []
      } else {
        fixed[key] = fixNullArrays(value)
      }
    }
    return fixed
  }
  return obj
}

const NULL_ARRAY_KEYS = new Set([
  'insert', 'delete', 'update',
  'friendsInfo', 'blackList',
  'groups', 'groupMembers',
  'conversationElems', 'conversations',
  'messageList', 'users',
])

let fetchPatched = false
function patchFetchForOpenIM(): void {
  if (fetchPatched) return
  fetchPatched = true

  const originalFetch = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch.call(this, input, init)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const apiAddr = getConfig().apiAddr
    if (!apiAddr || !url.startsWith(apiAddr)) {
      return response
    }

    try {
      const cloned = response.clone()
      const json = await cloned.json()
      const fixed = fixNullArrays(json)
      return new Response(JSON.stringify(fixed), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    } catch {
      return response
    }
  }
  logger.debug('OpenIM', 'fetch 拦截器已安装')
}

const parseSDKData = <T>(data: unknown): T => {
  if (typeof data === 'string') {
    return JSON.parse(data) as T
  }
  return data as T
}

const eventCallbacks: Record<OpenIMEventType, EventCallback[]> = {
  onConnecting: [],
  onConnectSuccess: [],
  onConnectFailed: [],
  onKickedOffline: [],
  onUserTokenExpired: [],
  onNewMessage: [],
  onConversationChanged: [],
}

export const getOpenIM = (): IMSDK => {
  if (!openIM) {
    patchFetchForOpenIM()
    openIM = getSDK({
      coreWasmPath: '/openIM.wasm',
      sqlWasmPath: '/sql-wasm.wasm',
      debug: false,
    })
  }
  return openIM
}

const LoginStatusEnum = {
  Logout: 1,
  Logging: 2,
  Logged: 3,
}

export const isLoggedIn = async (): Promise<boolean> => {
  const sdk = getOpenIM()
  try {
    const { data } = await sdk.getLoginStatus()
    return data === LoginStatusEnum.Logged
  } catch {
    return false
  }
}

let currentLoginUserID = ''
let currentLoginToken = ''

export const initOpenIM = async (userID: string, token: string): Promise<boolean> => {
  const sdk = getOpenIM()

  try {
    const alreadyLoggedIn = await isLoggedIn()

    if (alreadyLoggedIn) {
      if (currentLoginUserID === userID && currentLoginToken === token) {
        logger.debug('OpenIM', '已登录且凭证未变，跳过重复登录')
        return true
      }

      logger.debug('OpenIM', '检测到新凭证，重新登录')
      try {
        await sdk.logout()
      } catch (logoutErr) {
        logger.warn('OpenIM', '重新登录前登出失败（忽略）:', logoutErr)
      }
    }

    await sdk.login({
      userID,
      token,
      apiAddr: getConfig().apiAddr,
      wsAddr: getConfig().wsAddr,
      platformID: getConfig().platformID,
      logLevel: getConfig().logLevel,
      isLogStandardOutput: false,
    })

    currentLoginUserID = userID
    currentLoginToken = token

    setupEventListeners(sdk)

    logger.info('OpenIM', '登录成功')
    return true
  } catch (err) {
    logger.error('OpenIM', '登录失败:', err)
    throw err
  }
}

const setupEventListeners = (sdk: IMSDK): void => {
  sdk.on(CbEvents.OnConnecting, () => {
    eventCallbacks.onConnecting.forEach((cb) => cb(undefined))
  })

  sdk.on(CbEvents.OnConnectSuccess, () => {
    eventCallbacks.onConnectSuccess.forEach((cb) => cb(undefined))
  })

  sdk.on(CbEvents.OnConnectFailed, (data: unknown) => {
    logger.error('OpenIM', '连接失败:', data)
    eventCallbacks.onConnectFailed.forEach((cb) => cb(data))
  })

  sdk.on(CbEvents.OnKickedOffline, () => {
    logger.warn('OpenIM', '被踢下线')
    eventCallbacks.onKickedOffline.forEach((cb) => cb(undefined))
  })

  sdk.on(CbEvents.OnUserTokenExpired, () => {
    logger.warn('OpenIM', 'Token 已过期')
    eventCallbacks.onUserTokenExpired.forEach((cb) => cb(undefined))
  })

  sdk.on(CbEvents.OnRecvNewMessage, (data: unknown) => {
    const message = parseSDKData<Message>(data)
    eventCallbacks.onNewMessage.forEach((cb) => cb(message))
  })

  sdk.on(CbEvents.OnRecvNewMessages, (data: unknown) => {
    const eventData = data as { data: Message[] | string }
    const messages = parseSDKData<Message[]>(eventData.data)
    messages.forEach((message) => {
      eventCallbacks.onNewMessage.forEach((cb) => cb(message))
    })
  })

  sdk.on(CbEvents.OnConversationChanged, (data: unknown) => {
    let conversations: Conversation[]
    const parsed = parseSDKData<Conversation | Conversation[]>(data)

    if (Array.isArray(parsed)) {
      conversations = parsed
    } else {
      conversations = [parsed]
    }

    eventCallbacks.onConversationChanged.forEach((cb) => cb(conversations))
  })
}

export const on = <T = unknown>(event: OpenIMEventType, callback: EventCallback<T>): void => {
  if (eventCallbacks[event]) {
    eventCallbacks[event].push(callback as EventCallback)
  }
}

export const off = <T = unknown>(event: OpenIMEventType, callback: EventCallback<T>): void => {
  if (eventCallbacks[event]) {
    const index = eventCallbacks[event].indexOf(callback as EventCallback)
    if (index > -1) {
      eventCallbacks[event].splice(index, 1)
    }
  }
}

export const logout = async (): Promise<void> => {
  const sdk = getOpenIM()
  try {
    await sdk.logout()
    currentLoginUserID = ''
    currentLoginToken = ''
    logger.info('OpenIM', '登出成功')
  } catch (err) {
    logger.error('OpenIM', '登出失败:', err)
  }
}

export const getConversationList = async (): Promise<Conversation[]> => {
  const sdk = getOpenIM()
  try {
    const { data } = await sdk.getAllConversationList()
    return parseSDKData<Conversation[]>(data)
  } catch (err) {
    logger.error('OpenIM', '获取会话列表失败:', err)
    return []
  }
}

export const getConversationByUserID = async (
  userID: string,
  sessionType: number = 1
): Promise<Conversation | null> => {
  const sdk = getOpenIM()
  try {
    const { data } = await sdk.getOneConversation({
      sourceID: userID,
      sessionType,
    })
    return parseSDKData<Conversation>(data)
  } catch (err) {
    logger.error('OpenIM', '获取会话失败:', err)
    return null
  }
}

export const getHistoryMessages = async (
  conversationID: string,
  count: number = 20,
  startClientMsgID: string = ''
): Promise<Message[]> => {
  const sdk = getOpenIM()
  try {
    const { data } = await sdk.getAdvancedHistoryMessageList({
      conversationID,
      count,
      startClientMsgID,
      lastMinSeq: 0,
    } as any)
    const result = parseSDKData<{ messageList?: Message[] }>(data)
    return result.messageList || []
  } catch (err) {
    logger.error('OpenIM', '获取历史消息失败:', err)
    return []
  }
}

export const sendTextMessage = async (
  recvID: string,
  text: string,
  isGroup: boolean = false
): Promise<Message> => {
  const sdk = getOpenIM()
  try {
    const { data: msgData } = await sdk.createTextMessage(text)
    const msgObj = typeof msgData === 'string' ? JSON.parse(msgData) : msgData

    const { data } = await sdk.sendMessage({
      message: msgObj,
      recvID: isGroup ? '' : recvID,
      groupID: isGroup ? recvID : '',
    } as any)
    return parseSDKData<Message>(data)
  } catch (err) {
    logger.error('OpenIM', '发送消息失败:', err)
    throw err
  }
}

interface PicBaseInfo {
  uuid: string
  type: string
  size: number
  width: number
  height: number
  url: string
}

export const sendImageMessageByFile = async (
  recvID: string,
  _file: File,
  imageUrl: string,
  imageInfo: { width: number; height: number; size: number; type: string },
  isGroup: boolean = false
): Promise<Message> => {
  const sdk = getOpenIM()
  try {
    const uuid = `img_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

    const picInfo: PicBaseInfo = {
      uuid,
      type: imageInfo.type || 'image/jpeg',
      size: imageInfo.size,
      width: imageInfo.width,
      height: imageInfo.height,
      url: imageUrl,
    }

    let msgData: unknown

    try {
      const result = await sdk.createImageMessageByURL({
        sourcePicture: picInfo,
        bigPicture: picInfo,
        snapshotPicture: picInfo,
        sourcePath: imageUrl,
      } as any)
      msgData = result.data
    } catch {
      const customData = JSON.stringify({
        type: 'image',
        url: imageUrl,
        width: imageInfo.width,
        height: imageInfo.height,
        size: imageInfo.size,
      })
      const result = await sdk.createCustomMessage({
        data: customData,
        extension: '',
        description: '[图片]',
      })
      msgData = result.data
    }

    const sendOptions = {
      message: typeof msgData === 'string' ? JSON.parse(msgData) : msgData,
      recvID: isGroup ? '' : recvID,
      groupID: isGroup ? recvID : '',
    }

    const { data } = await sdk.sendMessageNotOss(sendOptions as any)
    return parseSDKData<Message>(data)
  } catch (err) {
    logger.error('OpenIM', '发送图片失败:', err)
    throw err
  }
}

export const markConversationAsRead = async (_conversationID: string): Promise<void> => {
  logger.debug('OpenIM', '标记已读已暂时禁用')
}

export const getSelfUserInfo = async (): Promise<UserInfo | null> => {
  const sdk = getOpenIM()
  try {
    const { data } = await sdk.getSelfUserInfo()
    return parseSDKData<UserInfo>(data)
  } catch (err) {
    logger.error('OpenIM', '获取用户信息失败:', err)
    return null
  }
}

export const sendUserInfoUpdatedMessage = async (
  agentUserID: string,
  updates: { nickname?: string; avatar?: string; userId?: string },
  previousValues?: { nickname?: string; avatar?: string; userId?: string }
): Promise<void> => {
  const sdk = getOpenIM()
  try {
    const messageData = {
      type: 'user_info_updated' as const,
      updates,
      previousValues,
      timestamp: Date.now(),
    }

    const { data: msgData } = await sdk.createCustomMessage({
      data: JSON.stringify(messageData),
      extension: JSON.stringify({ systemMessage: true, notDisplay: true }),
      description: '[用户信息更新]',
    })

    await sdk.sendMessage({
      message: typeof msgData === 'string' ? JSON.parse(msgData) : msgData,
      recvID: agentUserID,
      groupID: '',
    } as any)
  } catch (err) {
    logger.error('OpenIM', '发送用户信息更新消息失败:', err)
  }
}

export const sendVisitorOnlineMessage = async (
  agentUserID: string,
  visitorInfo: {
    visitorId: string
    deviceId: string
    nickname: string
    avatar: string
    isAnonymous: boolean
    source: string
    platformType: number
    metadata?: Record<string, unknown>
  }
): Promise<void> => {
  const sdk = getOpenIM()
  try {
    const messageData = {
      type: 'visitor_online' as const,
      ...visitorInfo,
      timestamp: Date.now(),
    }

    const { data: msgData } = await sdk.createCustomMessage({
      data: JSON.stringify(messageData),
      extension: JSON.stringify({ systemMessage: true, notDisplay: true }),
      description: '[访客上线]',
    })

    await sdk.sendMessage({
      message: typeof msgData === 'string' ? JSON.parse(msgData) : msgData,
      recvID: agentUserID,
      groupID: '',
    } as any)
  } catch (err) {
    logger.error('OpenIM', '发送访客上线消息失败:', err)
  }
}

export default {
  getOpenIM,
  initOpenIM,
  isLoggedIn,
  logout,
  on,
  off,
  getConversationList,
  getConversationByUserID,
  getHistoryMessages,
  sendTextMessage,
  sendImageMessageByFile,
  markConversationAsRead,
  getSelfUserInfo,
  sendUserInfoUpdatedMessage,
  sendVisitorOnlineMessage,
}
