export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

export interface Message {
  localId: string;
  idMessage?: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: MessageStatus;
  error?: string;
}

export interface Chat {
  id: string;
  name: string;
  phone: string;
  unread: number;
  createdAt: number;
  messages: Message[];
}

export interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
}

export interface GreenNotification {
  receiptId: number;
  body: {
    typeWebhook: string;
    timestamp?: number;
    idMessage?: string;
    chatId?: string;
    status?: string;
    stateInstance?: string;
    senderData?: {
      chatId: string;
      chatName?: string;
      chatType?: string;
      senderName?: string;
      senderContactName?: string;
      senderPhoneNumber?: number | string;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: { textMessage: string };
      extendedTextMessageData?: { text: string };
    };
  };
}

export interface ChatApi {
  getState(signal?: AbortSignal): Promise<string>;
  resolvePhone(phone: string, signal?: AbortSignal): Promise<string>;
  sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<string>;
  receiveNotification(signal: AbortSignal): Promise<GreenNotification | null>;
  deleteNotification(receiptId: number, signal: AbortSignal): Promise<void>;
}

export interface Session {
  mode: 'live' | 'demo';
  idInstance: string;
  api: ChatApi;
  storageKey: string;
}
