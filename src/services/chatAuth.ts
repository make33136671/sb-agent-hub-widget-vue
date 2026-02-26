import { getConfig } from '../config'
import { getClientId } from '../utils/clientId'
import { collectDeviceInfo } from '../utils/deviceInfo'
import type {
  GetImTokenRequest,
  GetImTokenResponse,
  ApiResponse,
  PlatformType,
} from '../types/chatAuth'

export async function getImToken(
  request: GetImTokenRequest
): Promise<GetImTokenResponse> {
  const formData = new FormData()
  formData.append('platformKey', request.platformKey)

  if (request.deviceId) {
    formData.append('deviceId', request.deviceId)
  }
  if (request.userId) {
    formData.append('userId', request.userId)
  }
  if (request.nickname) {
    formData.append('nickname', request.nickname)
  }
  if (request.avatar) {
    formData.append('avatar', request.avatar)
  }
  if (request.metadata) {
    formData.append('metadata', request.metadata)
  }

  formData.append('platformType', (request.platformType ?? 0).toString())

  const clientId = request.clientId || getClientId()
  formData.append('clientId', clientId)

  try {
    const deviceInfo = request.deviceInfo || JSON.stringify(collectDeviceInfo())
    formData.append('deviceInfo', deviceInfo)
  } catch {
    // ignore
  }

  const response = await fetch(`${getConfig().baseURL}/api/ChatAuth/GetImToken`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`HTTP 错误: ${response.status}`)
  }

  const result: ApiResponse<GetImTokenResponse> = await response.json()

  if (result.code !== 0) {
    throw new Error(result.message || '获取 IM Token 失败')
  }

  return result.data
}

export async function getImTokenSimple(
  platformKey: string,
  userId?: string,
  platformType: PlatformType = 0,
  options?: {
    nickname?: string
    avatar?: string
    deviceId?: string
    metadata?: string
  }
): Promise<GetImTokenResponse> {
  return getImToken({
    platformKey,
    userId,
    platformType,
    nickname: options?.nickname,
    avatar: options?.avatar,
    deviceId: options?.deviceId,
    metadata: options?.metadata,
  })
}

export async function updateUserInfo(
  platformKey: string,
  deviceId: string,
  userId?: string,
  nickname?: string,
  avatar?: string
): Promise<void> {
  const formData = new FormData()
  formData.append('PlatformKey', platformKey)
  formData.append('DeviceId', deviceId)

  if (userId) formData.append('UserId', userId)
  if (nickname) formData.append('Nickname', nickname)
  if (avatar) formData.append('Avatar', avatar)

  const response = await fetch(`${getConfig().baseURL}/api/ChatAuth/UpdateUserInfo`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`HTTP 错误: ${response.status}`)
  }

  const result: ApiResponse = await response.json()

  if (result.code !== 0) {
    throw new Error(result.message || '更新用户信息失败')
  }
}

export const chatAuthService = {
  getImToken,
  getImTokenSimple,
  updateUserInfo,
}

export default chatAuthService
