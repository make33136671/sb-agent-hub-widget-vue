export interface WidgetConfig {
  apiBaseUrl: string
  platformKey: string
  theme?: WidgetTheme
}

export interface WidgetTheme {
  primaryColor?: string
  headerBgColor?: string
  headerTextColor?: string
}

export interface ChatMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  contentType: number
  sendTime: number
  status: MessageStatus
}

export enum MessageStatus {
  Sending = 0,
  Sent = 1,
  Failed = 2,
}

export interface UserInfo {
  userId: string
  nickname: string
  avatar: string
  platformKey: string
}
