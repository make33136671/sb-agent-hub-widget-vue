export const PlatformType = {
  Web: 0,
  iOS: 1,
  Android: 2,
  Windows: 3,
  MacOS: 4,
  Linux: 5,
} as const

export type PlatformType = (typeof PlatformType)[keyof typeof PlatformType]

export const ChatUserType = {
  Anonymous: 0,
  Authenticated: 1,
  VIP: 2,
} as const

export type ChatUserType = (typeof ChatUserType)[keyof typeof ChatUserType]

export const KefuOnlineStatus = {
  Offline: 0,
  Online: 1,
  Busy: 2,
  Away: 3,
} as const

export type KefuOnlineStatus = (typeof KefuOnlineStatus)[keyof typeof KefuOnlineStatus]

export interface GetImTokenRequest {
  platformKey: string
  deviceId?: string
  userId?: string
  clientId?: string
  nickname?: string
  avatar?: string
  metadata?: string
  platformType?: PlatformType
  deviceInfo?: string
}

export interface ChatUserProfile {
  userId: string
  userType: ChatUserType
  isNewUser: boolean
  nickname: string
  avatar: string
  externalUserId?: string
  deviceId?: string
  firstVisitTime?: string
  tags?: string[]
  metadata?: Record<string, string>
}

export interface AssignedAgentInfo {
  agentUserId: string
  nickname: string
  avatar: string
  onlineStatus: KefuOnlineStatus
  isOnline: boolean
  welcomeMessage?: string
  autoSendWelcome: boolean
}

export interface PlatformConfigInfo {
  platformId: number
  platformName: string
  domain?: string
  logo?: string
  offlineMessage?: string
  allowOfflineMessage: boolean
  isWorkingHours: boolean
  nonWorkingMessage?: string
}

export interface FeatureFlags {
  allowImage: boolean
  allowFile: boolean
  allowVoice: boolean
  showOnlineStatus: boolean
  showReadStatus: boolean
  enableSatisfactionRating: boolean
}

export interface GetImTokenResponse {
  userID: string
  token: string
  expireTime: number
  user: ChatUserProfile
  agent: AssignedAgentInfo | null
  platform: PlatformConfigInfo | null
  features: FeatureFlags
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  type?: string
  data: T
}

export interface UpdateUserInfoRequest {
  platformKey: string
  deviceId: string
  userId?: string
  nickname?: string
  avatar?: string
}
