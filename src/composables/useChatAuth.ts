import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { getCore } from '../config'
import { logger } from '@saiboniuma/realtime-core'
import type {
  GetTokenRequest,
  GetTokenResponse,
  ChatUserProfile,
  AssignedAgentInfo,
  PlatformConfigInfo,
  FeatureFlags,
  PlatformType,
} from '@saiboniuma/realtime-core'
import { registerTokenRefreshCallback } from './useRealtime'

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

  login: (request: GetTokenRequest) => Promise<GetTokenResponse>
  loginSimple: (platformKey: string, options?: {
    userId?: string
    nickname?: string
    avatar?: string
    deviceId?: string
    platformType?: PlatformType
    source?: string
  }) => Promise<GetTokenResponse>
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

let lastLoginRequest: GetTokenRequest | null = null

const isLoggedIn = computed(() => !!userID.value && !!token.value)

export function useChatAuth(): UseChatAuthReturn {
  const login = async (
    request: GetTokenRequest
  ): Promise<GetTokenResponse> => {
    if (isLoggingIn.value) {
      throw new Error('正在登录中，请稍候')
    }

    const core = getCore()
    isLoggingIn.value = true
    error.value = null

    try {
      const authData = await core.auth.getToken(request)

      userID.value = authData.userID
      token.value = authData.token
      user.value = authData.user
      agent.value = authData.agent
      platform.value = authData.platform
      features.value = authData.features

      // 用服务端下发的 Realtime 地址更新配置
      if (authData.realtimeConfig) {
        core.updateRealtimeAddrs(authData.realtimeConfig.wsUrl)
      }

      // 设置当前会话 ID
      if (authData.agent?.conversationId) {
        core.setConversationId(authData.agent.conversationId)
      }

      core.session.saveAuthData(authData)
      lastLoginRequest = request

      await core.login(authData.userID, authData.token)

      registerTokenRefreshCallback(async () => {
        if (!lastLoginRequest) throw new Error('无法刷新：缺少登录参数')
        const newAuth = await core.auth.getToken(lastLoginRequest)
        if (newAuth.realtimeConfig) {
          core.updateRealtimeAddrs(newAuth.realtimeConfig.wsUrl)
        }
        userID.value = newAuth.userID
        token.value = newAuth.token
        core.session.saveAuthData(newAuth)
        await core.login(newAuth.userID, newAuth.token)
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
      core.session.clearAuthData()
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
      source?: string
    }
  ): Promise<GetTokenResponse> => {
    return login({
      platformKey,
      userId: options?.userId,
      nickname: options?.nickname,
      avatar: options?.avatar,
      deviceId: options?.deviceId,
      platformType: options?.platformType || 0,
      source: options?.source || 'vue',
    })
  }

  const logout = async (): Promise<void> => {
    const core = getCore()
    try {
      await core.logout()
    } catch (e) {
      logger.warn('ChatAuth', 'Realtime 登出失败:', e)
    }

    userID.value = null
    token.value = null
    user.value = null
    agent.value = null
    platform.value = null
    features.value = null
    error.value = null

    core.session.clearAuthData()
  }

  const restoreSession = async (): Promise<boolean> => {
    const core = getCore()
    const stored = core.session.loadAuthData()
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

      await core.login(stored.userID, stored.token)

      logger.info('ChatAuth', '会话恢复成功')
      return true
    } catch (e) {
      logger.warn('ChatAuth', '恢复会话失败:', e)
      core.session.clearAuthData()
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

    const core = getCore()
    core.session.updateUserProfile(updates)
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
