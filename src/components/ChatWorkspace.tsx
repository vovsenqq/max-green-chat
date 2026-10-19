import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, CircleHelp, LogOut, MessageCircle, Plus, RefreshCw, Search, X } from 'lucide-react';
import { ApiError } from '../api/greenApi';
import { createDemoState } from '../api/demoApi';
import { useNotifications } from '../hooks/useNotifications';
import { ChatStore } from '../lib/chatStore';
import { errorMessage, timeLabel } from '../lib/format';
import type { Session } from '../types';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { ChatView } from './ChatView';
import { NewChatDialog } from './NewChatDialog';

export function ChatWorkspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [store] = useState(() => session.mode === 'demo' ? new ChatStore(null, createDemoState()) : new ChatStore(session.storageKey));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const connection = useNotifications(session, store);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Set<string>>(new Set());
  const sendingRef = useRef(new Set<string>());
  const requests = useRef(new Set<AbortController>());
  const activeChat = state.chats.find((chat) => chat.id === state.activeChatId);

  useEffect(() => {
    const controllers = requests.current;
    return () => { controllers.forEach((controller) => controller.abort()); controllers.clear(); };
  }, []);

  useEffect(() => {
    const markRead = () => {
      const activeId = store.getSnapshot().activeChatId;
      if (document.visibilityState === 'visible' && activeId) {
        try { store.selectChat(activeId); } catch (error) { setError(errorMessage(error)); }
      }
    };
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [store]);

  function selectChat(id: string | null) {
    try { store.selectChat(id); } catch (error) { setError(errorMessage(error)); }
  }

  function sendMessage(chatId: string, text: string, retryId?: string): boolean {
    if (sendingRef.current.has(chatId) || !text.trim() || text.length > 4000) return false;
    let localId: string;
    try { localId = store.addOutgoing(chatId, text, retryId); }
    catch (error) { setError(errorMessage(error)); return false; }
    const controller = new AbortController();
    requests.current.add(controller);
    sendingRef.current.add(chatId);
    setSending(new Set(sendingRef.current));
    void (async () => {
      try {
        const idMessage = await session.api.sendMessage(chatId, text, controller.signal);
        if (controller.signal.aborted) return;
        store.updateOutgoing(chatId, localId, { idMessage, status: 'sent', error: undefined });
      } catch (error) {
        if (controller.signal.aborted) return;
        const uncertain = !(error instanceof ApiError) || error.retryable;
        try { store.updateOutgoing(chatId, localId, { status: uncertain ? 'unknown' : 'failed', error: errorMessage(error) }); }
        catch (storageError) { setError(errorMessage(storageError)); }
      } finally {
        requests.current.delete(controller);
        sendingRef.current.delete(chatId);
        if (!controller.signal.aborted) setSending(new Set(sendingRef.current));
      }
    })();
    return true;
  }

  const query = search.trim().toLocaleLowerCase('ru');
  const chats = state.chats.filter((chat) => `${chat.name} ${chat.phone}`.toLocaleLowerCase('ru').includes(query))
    .sort((a, b) => (b.messages.at(-1)?.timestamp ?? b.createdAt) - (a.messages.at(-1)?.timestamp ?? a.createdAt));
  const statusLabel = session.mode === 'demo' ? 'Деморежим' : {
    connecting: 'Подключение…', connected: 'Подключено', retrying: 'Переподключение…', paused: 'Получение остановлено',
  }[connection.status];

  return <main className={`chat-app ${activeChat ? 'chat-app--selected' : ''}`}>
    <nav className="nav-rail" aria-label="Главная навигация"><Brand compact />
      <button className="rail-button rail-button--active" title="Чаты" aria-label="Все чаты" onClick={() => selectChat(null)}><MessageCircle size={24} /></button>
      <div className="rail-bottom"><a className="rail-button" href="https://green-api.com/v3/docs/api/receiving/technology-http-api/" target="_blank" rel="noreferrer" title="Помощь с подключением" aria-label="Помощь с подключением"><CircleHelp size={23} /></a>
        <button className="rail-button" title="Выйти из аккаунта" aria-label="Выйти из аккаунта" onClick={onLogout}><LogOut size={23} /></button></div>
    </nav>
    <aside className="sidebar" aria-label="Список чатов">
      <div className="sidebar-heading"><div><span className="sidebar-eyebrow">MAX MESSENGER</span><h1>Чаты<span>{state.chats.length}</span></h1></div><button className="new-chat-button" aria-label="Создать новый чат" title="Новый чат" onClick={() => setShowNewChat(true)}><Plus size={23} /></button></div>
      <div className="search-field"><Search size={18} /><input aria-label="Поиск чатов" placeholder="Поиск по чатам" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Очистить поиск" className="icon-button" onClick={() => setSearch('')}><X size={16} /></button>}</div>
      <div className="chat-list">
        {chats.map((chat) => {
          const message = chat.messages.at(-1);
          return <button key={chat.id} className={`chat-item ${chat.id === state.activeChatId ? 'chat-item--active' : ''}`} aria-current={chat.id === state.activeChatId ? 'true' : undefined} onClick={() => selectChat(chat.id)}>
            <Avatar id={chat.id} name={chat.name} /><span className="chat-item-content"><span className="chat-item-top"><strong>{chat.name}</strong><time>{timeLabel(message?.timestamp ?? chat.createdAt)}</time></span>
              <span className="chat-item-bottom"><span className="chat-preview">{message ? `${message.direction === 'outgoing' ? 'Вы: ' : ''}${message.text}` : 'Начни общение'}</span>{chat.unread > 0 && <span className="unread-badge" aria-label={`${chat.unread} непрочитанных`}>{chat.unread > 99 ? '99+' : chat.unread}</span>}</span>
            </span>
          </button>;
        })}
        {chats.length === 0 && <div className="sidebar-empty"><MessageCircle size={29} /><h3>{query ? 'Ничего не найдено' : 'Пока здесь тихо'}</h3><p>{query ? 'Попробуй другое имя или номер' : 'Добавь собеседника, чтобы начать общение'}</p>{!query && <button className="text-button" onClick={() => setShowNewChat(true)}>Создать первый чат <ArrowUpRight size={15} /></button>}</div>}
      </div>
      <div className="account-panel"><span className="account-avatar">{session.mode === 'demo' ? 'D' : 'G'}</span><div><strong>{session.mode === 'demo' ? 'Демо-аккаунт' : `Инстанс ${session.idInstance}`}</strong><span className={`connection-label connection-label--${connection.status}`} role="status"><i />{statusLabel}</span></div><button className="icon-button" title="Выйти" aria-label="Выйти" onClick={onLogout}><LogOut size={18} /></button></div>
    </aside>
    <div className="main-panel">
      {session.mode === 'demo' && <div className="demo-banner"><span>Деморежим · сообщения остаются в браузере</span><button onClick={onLogout}>Подключить аккаунт <ArrowUpRight size={14} /></button></div>}
      {connection.error && <div className="connection-banner" role="alert"><span>{connection.error}</span><button onClick={connection.reconnect}><RefreshCw size={15} /> Повторить</button></div>}
      {error && <div className="connection-banner" role="alert"><span>{error}</span><button aria-label="Закрыть уведомление" onClick={() => setError('')}><X size={17} /></button></div>}
      {activeChat ? <ChatView key={activeChat.id} chat={activeChat} mode={session.mode} draft={drafts[activeChat.id] ?? ''} onDraft={(draft) => setDrafts((value) => ({ ...value, [activeChat.id]: draft }))} onBack={() => selectChat(null)} sending={sending.has(activeChat.id)} onSend={(text, retryId) => sendMessage(activeChat.id, text, retryId)} />
        : <section className="welcome-panel"><div className="welcome-art"><span className="welcome-orbit" /><Brand compact /><span className="welcome-mini-bubble"><MessageCircle size={23} /></span></div><span className="eyebrow">ПРОСТО БУДЬ НА СВЯЗИ</span><h2>Твой следующий разговор<br />начинается здесь</h2><p>Выбери чат слева или добавь собеседника<br />по номеру телефона.</p><button className="primary-button" onClick={() => setShowNewChat(true)}><Plus size={19} /> Новый чат</button><span className="welcome-caption">MAX × GREEN-API</span></section>}
    </div>
    {showNewChat && <NewChatDialog session={session} store={store} onClose={() => setShowNewChat(false)} />}
  </main>;
}
