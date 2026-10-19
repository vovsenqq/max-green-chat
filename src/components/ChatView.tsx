import { useEffect, useRef, type FormEvent } from 'react';
import { ArrowLeft, Check, CheckCheck, CircleAlert, Clock3, MessageCircle, Send, RotateCcw } from 'lucide-react';
import type { Chat, Message, Session } from '../types';
import { dateKey, dayLabel, formatPhone, timeLabel } from '../lib/format';
import { Avatar } from './Avatar';

const statusLabels = {
  pending: 'Отправляется', sent: 'Принято GREEN-API', delivered: 'Доставлено', read: 'Прочитано',
  failed: 'Не отправлено', unknown: 'Статус доставки неизвестен',
};

function MessageBubble({ message, mode, onRetry }: { message: Message; mode: Session['mode']; onRetry: () => void }) {
  const outgoing = message.direction === 'outgoing';
  return <div className={`message-row ${outgoing ? 'message-row--out' : ''}`}>
    <article className={`message-bubble ${outgoing ? 'message-bubble--out' : ''} ${message.status === 'failed' || message.status === 'unknown' ? 'message-bubble--error' : ''}`}>
      <p>{message.text}</p>
      <span className="message-meta"><time dateTime={new Date(message.timestamp).toISOString()}>{timeLabel(message.timestamp)}</time>
        {outgoing && <span className={`message-status message-status--${message.status}`} title={mode === 'demo' ? 'Сохранено локально в демо' : statusLabels[message.status]} aria-label={statusLabels[message.status]}>
          {message.status === 'pending' ? <Clock3 size={13} />
            : message.status === 'failed' || message.status === 'unknown' ? <CircleAlert size={13} />
              : message.status === 'delivered' || message.status === 'read' ? <CheckCheck size={16} /> : <Check size={15} />}
        </span>}
      </span>
      {outgoing && message.status === 'failed' && <div className="message-error"><span>{message.error || 'Сообщение не доставлено.'}</span><button onClick={onRetry}><RotateCcw size={12} /> Повторить</button></div>}
      {outgoing && message.status === 'unknown' && <div className="message-error">Ответ не получен. Сообщение могло отправиться — проверь доставку в MAX перед повтором.</div>}
    </article>
  </div>;
}

interface Props {
  chat: Chat;
  mode: Session['mode'];
  draft: string;
  onDraft: (value: string) => void;
  onBack: () => void;
  onSend: (text: string, retryId?: string) => boolean;
  sending: boolean;
}

export function ChatView({ chat, mode, draft, onDraft, onBack, onSend, sending }: Props) {
  const messagesElement = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const lastMessage = chat.messages.at(-1);

  useEffect(() => {
    if (nearBottom.current || lastMessage?.direction === 'outgoing') {
      const element = messagesElement.current;
      if (element) element.scrollTop = element.scrollHeight;
    }
  }, [chat.messages.length, lastMessage?.localId, lastMessage?.direction]);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 160)}px`;
    }
  }, [draft]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || !draft.trim() || draft.length > 4000) return;
    if (onSend(draft.trim())) {
      onDraft('');
      nearBottom.current = true;
      textarea.current?.focus();
    }
  }

  return <section className="conversation" aria-label={`Чат: ${chat.name}`}>
    <header className="conversation-header">
      <button className="icon-button mobile-back" onClick={onBack} aria-label="Назад к чатам"><ArrowLeft size={22} /></button>
      <Avatar name={chat.name} id={chat.id} small />
      <div><h2>{chat.name}</h2><p>{formatPhone(chat.phone) && chat.name !== formatPhone(chat.phone) ? `${formatPhone(chat.phone)} · ` : ''}{mode === 'demo' ? 'Демонстрационный чат' : 'MAX · текстовые сообщения'}</p></div>
      <span className="conversation-tag">{mode === 'demo' ? 'Демо' : 'MAX'}</span>
    </header>
    <div className="message-area" ref={messagesElement} onScroll={() => {
      const element = messagesElement.current;
      if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    }}>
      {chat.messages.length === 0 ? <div className="conversation-start"><span><MessageCircle size={25} /></span><h3>Начни разговор</h3><p>Отправь первое сообщение.<br />Ответ появится здесь автоматически.</p></div>
        : <div className="message-list" role="log" aria-label="Сообщения" aria-live="polite" aria-relevant="additions">
          {chat.messages.map((message, index) => <div key={message.localId}>
            {(index === 0 || dateKey(chat.messages[index - 1].timestamp) !== dateKey(message.timestamp)) && <div className="day-separator"><span>{dayLabel(message.timestamp)}</span></div>}
            <MessageBubble message={message} mode={mode} onRetry={() => onSend(message.text, message.localId)} />
          </div>)}
        </div>}
    </div>
    <form className="composer" onSubmit={submit}>
      <div className="composer-input"><label className="sr-only" htmlFor="message-text">Текст сообщения</label>
        <textarea ref={textarea} id="message-text" placeholder="Напиши сообщение…" rows={1} maxLength={4000} value={draft} onChange={(event) => onDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(event); }
        }} />
        <span className="character-count" aria-live="off">{draft.length > 3500 ? `${draft.length}/4000` : ''}</span>
      </div>
      <button className="send-button" type="submit" disabled={sending || !draft.trim()} aria-label={sending ? 'Сообщение отправляется' : 'Отправить сообщение'}>{sending ? <span className="spinner" /> : <Send size={21} />}</button>
      <p className="composer-hint">{mode === 'demo' ? 'Деморежим: сообщения не отправляются в MAX' : 'Enter — отправить · Shift + Enter — новая строка'}</p>
    </form>
  </section>;
}
