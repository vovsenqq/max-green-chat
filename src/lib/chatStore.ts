import type { Chat, ChatState, GreenNotification, Message, MessageStatus } from '../types';
import { formatPhone } from './format';

const emptyState = (): ChatState => ({ chats: [], activeChatId: null });
const statuses: MessageStatus[] = ['pending', 'sent', 'delivered', 'read', 'failed', 'unknown'];

function isState(value: unknown): value is ChatState {
  if (!value || typeof value !== 'object') return false;
  const state = value as ChatState;
  return (state.activeChatId === null || typeof state.activeChatId === 'string') && Array.isArray(state.chats)
    && state.chats.every((chat) => typeof chat?.id === 'string' && typeof chat.name === 'string'
      && typeof chat.phone === 'string' && Number.isFinite(chat.createdAt) && Number.isFinite(chat.unread)
      && Array.isArray(chat.messages) && chat.messages.every((message) => typeof message?.localId === 'string'
        && typeof message.text === 'string' && Number.isFinite(message.timestamp)
        && ['incoming', 'outgoing'].includes(message.direction) && statuses.includes(message.status)
        && (message.idMessage === undefined || typeof message.idMessage === 'string')
        && (message.error === undefined || typeof message.error === 'string')));
}

/** The token never enters this store. Persist synchronously before acknowledging a notification. */
export class ChatStore {
  private state: ChatState;
  private readonly listeners = new Set<() => void>();
  private readonly delivery = new Map<string, MessageStatus>();

  constructor(private readonly storageKey: string | null, initialState = emptyState()) {
    this.state = initialState;
    if (storageKey) {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (!isState(parsed)) throw new Error('Invalid history');
          this.state = {
            ...parsed,
            chats: parsed.chats.map((chat) => ({ ...chat, messages: chat.messages.map((message) => message.status === 'pending'
              ? { ...message, status: 'unknown', error: 'Сессия завершилась до ответа API. Проверьте доставку в MAX.' }
              : message) })),
          };
        }
      } catch {
        throw new Error('Не удалось открыть историю вкладки. Разрешите sessionStorage или очистите историю кнопкой ниже.');
      }
    }
  }

  getSnapshot = (): ChatState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private commit(state: ChatState): void {
    if (this.storageKey) {
      try { sessionStorage.setItem(this.storageKey, JSON.stringify(state)); }
      catch { throw new Error('История не сохранена: sessionStorage недоступен или заполнен. Получение остановлено; освободите место или начните новую сессию.'); }
    }
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  selectChat(id: string | null): void {
    this.commit({ ...this.state, activeChatId: id,
      chats: this.state.chats.map((chat) => chat.id === id ? { ...chat, unread: 0 } : chat) });
  }

  addChat(id: string, phone: string): void {
    const existing = this.state.chats.find((chat) => chat.id === id);
    this.commit({ activeChatId: id, chats: existing
      ? this.state.chats.map((chat) => chat.id === id ? { ...chat, phone: chat.phone || phone, unread: 0 } : chat)
      : [{ id, phone, name: formatPhone(phone), unread: 0, createdAt: Date.now(), messages: [] }, ...this.state.chats] });
  }

  addOutgoing(chatId: string, text: string, retryId?: string): string {
    const localId = retryId ?? crypto.randomUUID();
    this.commit({ ...this.state, chats: this.state.chats.map((chat) => chat.id !== chatId ? chat : {
      ...chat,
      messages: retryId ? chat.messages.map((message) => message.localId === retryId
        ? { ...message, idMessage: undefined, status: 'pending', error: undefined } : message)
        : [...chat.messages, { localId, text, timestamp: Date.now(), direction: 'outgoing', status: 'pending' }],
    }) });
    return localId;
  }

  updateOutgoing(chatId: string, localId: string, patch: Partial<Message>): void {
    const knownStatus = patch.idMessage ? this.delivery.get(patch.idMessage) : undefined;
    this.commit({ ...this.state, chats: this.state.chats.map((chat) => chat.id !== chatId ? chat : {
      ...chat, messages: chat.messages.map((message) => message.localId !== localId ? message
        : { ...message, ...patch, ...(knownStatus ? { status: knownStatus } : {}) }),
    }) });
  }

  applyNotification({ body }: GreenNotification): void {
    if (body.typeWebhook === 'outgoingMessageStatus' && body.idMessage) {
      const failureMessages: Record<string, string> = {
        failed: 'MAX не смог отправить сообщение.',
        noAccount: 'У получателя нет аккаунта MAX.',
        notInGroup: 'Отправитель не является участником этого чата.',
      };
      const failure = body.status ? failureMessages[body.status] : undefined;
      const status = (failure ? 'failed' : body.status) as MessageStatus;
      if (!['sent', 'delivered', 'read', 'failed'].includes(status)) return;
      const rank: Record<string, number> = { pending: 0, unknown: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
      const previous = this.delivery.get(body.idMessage);
      if (previous && rank[previous] > rank[status]) return;
      this.delivery.set(body.idMessage, status);
      this.commit({ ...this.state, chats: this.state.chats.map((chat) => ({ ...chat, messages: chat.messages.map((message) =>
        message.idMessage === body.idMessage && rank[status] >= rank[message.status] ? { ...message, status, error: failure } : message) })) });
      return;
    }
    if (body.typeWebhook !== 'incomingMessageReceived') return;
    const data = body.messageData;
    const text = data?.typeMessage === 'textMessage' ? data.textMessageData?.textMessage
      : data?.typeMessage === 'extendedTextMessage' ? data.extendedTextMessageData?.text : undefined;
    // Files, reactions, system and outgoing echo events are deliberately consumed, without rendering.
    if (text === undefined) return;
    if (!body.idMessage || !body.senderData?.chatId || typeof text !== 'string') {
      throw new Error('Текстовое уведомление не содержит обязательных полей. Получение приостановлено.');
    }
    const id = String(body.senderData.chatId);
    const existing = this.state.chats.find((chat) => chat.id === id);
    if (existing?.messages.some((message) => message.idMessage === body.idMessage)) return;
    const phone = body.senderData.senderPhoneNumber ? String(body.senderData.senderPhoneNumber) : '';
    const name = body.senderData.chatName || body.senderData.senderContactName || body.senderData.senderName || formatPhone(phone) || id;
    const chat: Chat = existing ?? { id, phone, name, unread: 0, createdAt: Date.now(), messages: [] };
    const incoming: Message = { localId: crypto.randomUUID(), idMessage: body.idMessage, text,
      timestamp: body.timestamp && Number.isFinite(body.timestamp) ? body.timestamp * 1000 : Date.now(),
      direction: 'incoming', status: 'delivered' };
    const updated: Chat = { ...chat, name, phone: chat.phone || phone,
      unread: this.state.activeChatId === id && document.visibilityState === 'visible' ? 0 : chat.unread + 1,
      messages: [...chat.messages, incoming].sort((a, b) => a.timestamp - b.timestamp) };
    this.commit({ ...this.state, chats: existing
      ? this.state.chats.map((item) => item.id === id ? updated : item) : [updated, ...this.state.chats] });
  }
}
