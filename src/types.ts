export type RoomDescriptor = {
  roomId: string
  secret: string
}

export type Participant = {
  id: string
  name: string
  initials: string
  hue: number
  isSelf: boolean
}

export type ReplyQuote = {
  id: string
  senderName: string
  kind: 'text' | 'file'
  preview: string
}

export type ReactionMap = Record<string, string[]>

export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'failed'
  | 'receiving'

export type TextMessage = {
  kind: 'text'
  id: string
  senderId: string
  sentAt: number
  text: string
  replyTo: ReplyQuote | null
  reactions: ReactionMap
  status: MessageStatus
}

export type SharedFile = {
  name: string
  mime: string
  size: number
  url: string | null
  progress: number
}

export type FileMessage = {
  kind: 'file'
  id: string
  senderId: string
  sentAt: number
  file: SharedFile
  replyTo: ReplyQuote | null
  reactions: ReactionMap
  status: MessageStatus
}

export type SystemMessage = {
  kind: 'system'
  id: string
  sentAt: number
  event: 'joined' | 'left' | 'notice'
  actorId: string | null
  text: string | null
}

export type ChatMessage = TextMessage | FileMessage | SystemMessage

export type WireReplyQuote = {
  id: string
  senderName: string
  kind: 'text' | 'file'
  preview: string
}

export type WireTextMessage = {
  version: number
  id: string
  text: string
  sentAt: number
  replyTo: WireReplyQuote | null
}

export type WireReaction = {
  version: number
  messageId: string
  emoji: string
  active: boolean
}

export type WireTyping = {
  version: number
  active: boolean
}

export type WireFileMetadata = {
  version: number
  id: string
  name: string
  mime: string
  size: number
  sentAt: number
  replyTo: WireReplyQuote | null
}

export type ConnectionState = 'connecting' | 'ready' | 'offline' | 'degraded'
