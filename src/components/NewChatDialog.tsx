import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Phone, X } from 'lucide-react';
import { errorMessage, normalizePhone } from '../lib/format';
import type { ChatStore } from '../lib/chatStore';
import type { Session } from '../types';

export function NewChatDialog({ session, store, onClose }: { session: Session; store: ChatStore; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { request.current?.abort(); element?.close(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const number = normalizePhone(phone);
      const existing = store.getSnapshot().chats.find((chat) => chat.phone === number);
      const id = existing?.id ?? await session.api.resolvePhone(number, controller.signal);
      if (controller.signal.aborted) return;
      store.addChat(id, number);
      onClose();
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <dialog ref={dialog} className="new-chat-dialog" aria-labelledby="new-chat-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content">
      <button className="icon-button dialog-close" aria-label="Закрыть" onClick={onClose}><X size={21} /></button>
      <div className="card-icon"><Phone size={23} /></div>
      <h2 id="new-chat-title">Новый разговор</h2>
      <p className="muted">Введи номер телефона собеседника.<br />Мы найдём его аккаунт в MAX.</p>
      <form onSubmit={submit}>
        <label htmlFor="recipient-phone">Номер телефона</label>
        <input autoFocus id="recipient-phone" type="tel" autoComplete="tel" placeholder="+7 999 123-45-67" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy} required aria-describedby="phone-hint" />
        <p className="field-hint" id="phone-hint">С кодом страны. Для РФ можно начать с +7 или 8.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Ищем в MAX…</> : <>Начать общение <ArrowRight size={18} /></>}</button>
      </form>
      {session.mode === 'demo' && <p className="field-hint">Деморежим: номер не проверяется, сообщения остаются локальными.</p>}
    </div>
  </dialog>;
}
