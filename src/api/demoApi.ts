import type { ChatApi, ChatState } from '../types';

export function createDemoApi(): ChatApi {
  return {
    getState: async () => 'authorized',
    resolvePhone: async (phone) => `demo-${phone}`,
    sendMessage: async () => `demo-${crypto.randomUUID()}`,
    receiveNotification: async () => null,
    deleteNotification: async () => {},
  };
}

export function createDemoState(): ChatState {
  const now = Date.now();
  return { activeChatId: 'demo-anna', chats: [
    { id: 'demo-anna', name: 'Анна Смирнова', phone: '', unread: 0, createdAt: now - 600_000, messages: [
      { localId: 'demo-1', text: 'Привет! Это демо чата MAX 👋', timestamp: now - 600_000, direction: 'incoming', status: 'delivered' },
      { localId: 'demo-2', text: 'Здесь можно посмотреть интерфейс без подключения аккаунта.', timestamp: now - 540_000, direction: 'incoming', status: 'delivered' },
      { localId: 'demo-3', text: 'Привет! Всё выглядит отлично. Попробую отправить сообщение.', timestamp: now - 480_000, direction: 'outgoing', status: 'read' },
      { localId: 'demo-4', text: 'Для настоящей переписки выйди из демо и подключи свой инстанс GREEN-API.', timestamp: now - 420_000, direction: 'incoming', status: 'delivered' },
    ] },
    { id: 'demo-team', name: 'Команда проекта', phone: '', unread: 1, createdAt: now - 900_000, messages: [
      { localId: 'demo-5', text: 'Все сообщения в демо остаются в этой вкладке.', timestamp: now - 900_000, direction: 'incoming', status: 'delivered' },
    ] },
  ] };
}
