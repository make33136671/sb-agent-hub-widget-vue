import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { chatAuthService } from '../services/chatAuth'
import { initOpenIM, logout as logoutOpenIM } from '../services/openIM'
import { registerTokenRefreshCallback } from './useOpenIM'
import logger from '../utils/logger'
import type {
  GetImTokenRequest,
  GetImTokenResponse,
  ChatUserProfile,
  AssignedAgentInfo,
  PlatformConfigInfo,
  FeatureFlags,
  PlatformType,
} from '../types/chatAuth'

const STORAGE_KEY = 'chat_auth_data'

export interface UseChatAuthReturn {
  isLoggedIn: ComputedRef<boolean>
  isLoggingIn: Ref<boolean>
  userID: Ref<string | null>
  token: Ref<string | null>
  user: Ref<ChatUserProfile | null>
  agent: Ref<AssignedAgentInfo | null>
  platform: Ref<PlatformConfigInfo | null>
  features: Ref<FeatureFlags | null>
  error: Ref<string | null>

  login: (request: GetImTokenRequest) => Promise<GetImTokenResponse>
  loginSimple: (platformKey: string, options?: {
    userId?: string
    nickname?: string
    avatar?: string
    deviceId?: string
    platformType?: PlatformType
  }) => Promise<GetImTokenResponse>
  logout: () => Promise<void>
  restoreSession: () => Promise<boolean>
  updateUserProfile: (updates: { nickname?: string; avatar?: string }) => void
}

const userID = ref<string | null>(null)
const token = ref<string | null>(null)
const user = ref<ChatUserProfile | null>(null)
const agent = ref<AssignedAgentInfo | null>(null)
const platform = ref<PlatformConfigInfo | null>(null)
const features = ref<FeatureFlags | null>(null)
const isLoggingIn = ref(false)
const error = ref<string | null>(null)

let lastLoginRequest: GetImTokenRequest | null = null

const isLoggedIn = computed(() => !!userID.value && !!token.value)

function saveAuthData(data: GetImTokenResponse): void {
  try {
    const storageData = {
      userID: data.userID,
      token: data.token,
      user: data.user,
      agent: data.agent,
      platform: data.platform,
      features: data.features,
      expireAt: Date.now() + data.expireTime * 1000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
  } catch (e) {
    logger.warn('ChatAuth', '保存认证数据失败:', e)
  }
}

function loadAuthData(): (GetImTokenResponse & { expireAt: number }) | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const data = JSON.parse(stored)
    if (data.expireAt && data.expireAt - 5 * 60 * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch (e) {
    logger.warn('ChatAuth', '加载认证数据失败:', e)
    return null
  }
}

function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function useChatAuth(): UseChatAuthReturn {
  const login = async (
    request: GetImTokenRequest
  ): Promise<GetImTokenResponse> => {
    if (isLoggingIn.value) {
      throw new Error('正在登录中，请稍候')
    }

    isLoggingIn.value = true
    error.value = null

    try {
      const authData = await chatAuthService.getImToken(request)

      userID.value = authData.userID
      token.value = authData.token
      user.value = authData.user
      agent.value = authData.agent
      platform.value = authData.platform
      features.value = authData.features

      saveAuthData(authData)
      lastLoginRequest = request

      await initOpenIM(authData.userID, authData.token)

      registerTokenRefreshCallback(async () => {
        if (!lastLoginRequest) throw new Error('无法刷新：缺少登录参数')
        const newAuth = await chatAuthService.getImToken(lastLoginRequest)
        userID.value = newAuth.userID
        token.value = newAuth.token
        saveAuthData(newAuth)
        await initOpenIM(newAuth.userID, newAuth.token)
      })

      logger.info('ChatAuth', '登录成功:', {
        userID: authData.userID,
        userName: authData.user?.nickname,
        agentID: authData.agent?.agentUserId,
      })

      return authData
    } catch (e) {
      const message = e instanceof Error ? e.message : '登录失败'
      error.value = message
      logger.error('ChatAuth', '登录失败:', e)
      clearAuthData()
      throw e
    } finally {
      isLoggingIn.value = false
    }
  }

  const loginSimple = async (
    platformKey: string,
    options?: {
      userId?: string
      nickname?: string
      avatar?: string
      deviceId?: string
      platformType?: PlatformType
    }
  ): Promise<GetImTokenResponse> => {
    return login({
      platformKey,
      userId: options?.userId,
      nickname: options?.nickname,
      avatar: options?.avatar,
      deviceId: options?.deviceId,
      platformType: options?.platformType || 0,
    })
  }

  const logout = async (): Promise<void> => {
    try {
      await logoutOpenIM()
    } catch (e) {
      logger.warn('ChatAuth', 'OpenIM 登出失败:', e)
    }

    userID.value = null
    token.value = null
    user.value = null
    agent.value = null
    platform.value = null
    features.value = null
    error.value = null

    clearAuthData()
  }

  const restoreSession = async (): Promise<boolean> => {
    const stored = loadAuthData()
    if (!stored) return false

    isLoggingIn.value = true
    error.value = null

    try {
      userID.value = stored.userID
      token.value = stored.token
      user.value = stored.user
      agent.value = stored.agent
      platform.value = stored.platform
      features.value = stored.features

      await initOpenIM(stored.userID, stored.token)

      logger.info('ChatAuth', '会话恢复成功')
      return true
    } catch (e) {
      logger.warn('ChatAuth', '恢复会话失败:', e)
      clearAuthData()
      userID.value = null
      token.value = null
      user.value = null
      agent.value = null
      platform.value = null
      features.value = null
      return false
    } finally {
      isLoggingIn.value = false
    }
  }

  const updateUserProfile = (updates: { nickname?: string; avatar?: string }): void => {
    if (!user.value) return

    const updatedUser = { ...user.value }
    if (updates.nickname !== undefined) updatedUser.nickname = updates.nickname
    if (updates.avatar !== undefined) updatedUser.avatar = updates.avatar
    user.value = updatedUser

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.user) {
          if (updates.nickname !== undefined) data.user.nickname = updates.nickname
          if (updates.avatar !== undefined) data.user.avatar = updates.avatar
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        }
      }
    } catch (e) {
      logger.warn('ChatAuth', '更新本地存储失败:', e)
    }
  }

  return {
    isLoggedIn,
    isLoggingIn,
    userID,
    token,
    user,
    agent,
    platform,
    features,
    error,
    login,
    loginSimple,
    logout,
    restoreSession,
    updateUserProfile,
  }
}

export default useChatAuth
