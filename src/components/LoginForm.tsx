import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Eye, EyeOff, ExternalLink, LockKeyhole, MessageCircle, ShieldCheck } from 'lucide-react';
import { createGreenApi, normalizeApiUrl } from '../api/greenApi';
import { createDemoApi } from '../api/demoApi';
import { errorMessage, instanceStateMessage } from '../lib/format';
import type { Session } from '../types';
import { Brand } from './Brand';

export function LoginForm({ onConnect }: { onConnect: (session: Session) => void }) {
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_GREEN_API_URL ?? '');
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setToken] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const api = createGreenApi({ apiUrl, idInstance, apiTokenInstance });
      const state = await api.getState(controller.signal);
      if (controller.signal.aborted) return;
      if (state !== 'authorized') throw new Error(instanceStateMessage(state));
      onConnect({ mode: 'live', api, idInstance: idInstance.trim(),
        storageKey: `max-green-chat:v1:${normalizeApiUrl(apiUrl)}:${idInstance.trim()}` });
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <main className="login-page">
    <div className="login-topbar"><Brand /><a href="https://green-api.com/v3/docs/" target="_blank" rel="noreferrer">Документация <ExternalLink size={15} /></a></div>
    <div className="login-layout">
      <section className="login-intro">
        <span className="eyebrow"><span className="green-dot" /> НА СВЯЗИ ЧЕРЕЗ GREEN-API</span>
        <h1>Простое общение.<br /><span>Знакомый MAX.</span></h1>
        <p className="intro-copy">Твои сообщения — в одном окне.<br />Подключи аккаунт и начни разговор.</p>
        <div className="intro-conversation" aria-hidden="true">
          <div className="intro-avatar">А</div>
          <div className="intro-bubble">Привет! Остаёмся на связи? <span>12:40</span></div>
          <div className="intro-bubble intro-bubble--out">Конечно, я здесь 👋 <span>12:41 <Check size={14} /></span></div>
        </div>
        <div className="intro-footnote"><ShieldCheck size={18} /> Токен хранится только в памяти вкладки</div>
      </section>
      <section className="login-card" aria-labelledby="login-heading">
        <div className="card-icon"><LockKeyhole size={23} /></div>
        <h2 id="login-heading">Подключение к MAX</h2>
        <p className="muted">Введи данные MAX-инстанса из <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">личного кабинета GREEN-API <ExternalLink size={12} /></a></p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label htmlFor="api-url">apiUrl</label>
            <input id="api-url" type="url" autoComplete="url" placeholder="https://3100.api.green-api.com" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} required spellCheck={false} aria-describedby="api-url-hint" />
            <p className="field-hint" id="api-url-hint">Скопируй адрес API своего инстанса целиком</p>
            <label htmlFor="instance-id">idInstance</label>
            <input id="instance-id" type="text" inputMode="numeric" autoComplete="off" placeholder="Номер инстанса" value={idInstance} onChange={(event) => setIdInstance(event.target.value)} required pattern="[0-9]+" spellCheck={false} />
            <label htmlFor="api-token">apiTokenInstance</label>
            <div className="password-field"><input id="api-token" type={visible ? 'text' : 'password'} autoComplete="off" placeholder="Токен доступа" value={apiTokenInstance} onChange={(event) => setToken(event.target.value)} required spellCheck={false} />
              <button type="button" className="icon-button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Скрыть токен' : 'Показать токен'}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
          </fieldset>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Подключаемся…</> : <>Подключить аккаунт <ArrowRight size={18} /></>}</button>
        </form>
        <div className="divider"><span>или сначала посмотри интерфейс</span></div>
        <button className="secondary-button demo-button" disabled={busy} onClick={() => onConnect({ mode: 'demo', idInstance: 'Демо', api: createDemoApi(), storageKey: '' })}><MessageCircle size={18} /> Открыть демо без токена</button>
        <p className="login-note">Инстанс должен быть авторизован в MAX.<br />Для входящих сообщений включи incomingWebhook и оставь webhookUrl пустым.</p>
      </section>
    </div>
    <footer className="login-footer"><span>Тестовое задание · React + GREEN-API</span><span>Только текст. Только общение.</span></footer>
  </main>;
}
