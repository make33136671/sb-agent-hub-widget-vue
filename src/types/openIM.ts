export const MessageType = {
  TextMessage: 101,
  PictureMessage: 102,
  VoiceMessage: 103,
  VideoMessage: 104,
  FileMessage: 105,
  AtTextMessage: 106,
  MergeMessage: 107,
  CardMessage: 108,
  LocationMessage: 109,
  CustomMessage: 110,
  TypingMessage: 113,
  QuoteMessage: 114,
  FaceMessage: 115,
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]

export interface TextElement {
  content: string
}

export interface Picture {
  uuid: string
  type: string
  size: number
  width: number
  height: number
  url: string
}

export interface PictureElem {
  sourcePath: string
  sourcePicture: Picture
  bigPicture: Picture
  snapshotPicture: Picture
}

export interface CustomElem {
  data: string
  extension: string
  description: string
}

export interface CustomImageData {
  type: 'image'
  url: string
  width: number
  height: number
  size: number
}

export interface Message {
  clientMsgID: string
  serverMsgID: string
  createTime: number
  sendTime: number
  sendID: string
  recvID: string
  msgFrom: number
  contentType: MessageType | number
  senderNickname: string
  senderFaceUrl: string
  content: string
  textElem?: TextElement
  pictureElem?: PictureElem
  customElem?: CustomElem
  conversationID: string
  isRead: boolean
  status: number
}

export interface Conversation {
  conversationID: string
  conversationType: number
  userID: string
  groupID: string
  showName: string
  faceURL: string
  recvMsgOpt: number
  unreadCount: number
  latestMsg: string
  latestMsgSendTime: number
  draftText: string
  draftTextTime: number
  isPinned: boolean
  isPrivateChat: boolean
}

export interface UserInfo {
  userID: string
  nickname: string
  faceURL: string
  createTime: number
  ex: string
}

export const ConnectionStatus = {
  CONNECTING: 0,
  CONNECTED: 1,
  DISCONNECTED: 2,
  FAILED: 3,
} as const

export type OpenIMEventType =
  | 'onConnecting'
  | 'onConnectSuccess'
  | 'onConnectFailed'
  | 'onKickedOffline'
  | 'onUserTokenExpired'
  | 'onNewMessage'
  | 'onConversationChanged'

export type EventCallback<T = unknown> = (data: T) => void
