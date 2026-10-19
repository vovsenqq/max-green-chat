import { useEffect, useState } from 'react';
import { ApiError } from '../api/greenApi';
import type { ChatStore } from '../lib/chatStore';
import { errorMessage, instanceStateMessage } from '../lib/format';
import type { Session } from '../types';

type Connection = { status: 'connecting' | 'connected' | 'retrying' | 'paused'; error: string | null };

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { window.clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = window.setTimeout(done, ms);
    if (signal.aborted) done();
    else signal.addEventListener('abort', done, { once: true });
  });
}

export function useNotifications(session: Session, store: ChatStore) {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<Connection>({ status: 'connecting', error: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let failures = 0;

    async function listen() {
      if (session.mode === 'demo') {
        setConnection({ status: 'connected', error: null });
        return;
      }
      setConnection({ status: 'connecting', error: null });
      // Defer work one task so StrictMode's initial cleanup cancels the first consumer.
      await delay(0, signal);
      while (!signal.aborted) {
        try {
          const notification = await session.api.receiveNotification(signal);
          if (signal.aborted) return;
          if (notification) {
            store.applyNotification(notification);
            // Snapshot has been saved to sessionStorage before receipt deletion.
            await session.api.deleteNotification(notification.receiptId, signal);
            if (signal.aborted) return;
            if (notification.body.typeWebhook === 'stateInstanceChanged'
              && notification.body.stateInstance && notification.body.stateInstance !== 'authorized') {
              setConnection({ status: 'paused', error: instanceStateMessage(notification.body.stateInstance) });
              return;
            }
          }
          failures = 0;
          setConnection({ status: 'connected', error: null });
          // Prevent a busy loop if a server returns an empty queue immediately.
          await delay(notification ? 100 : 500, signal);
        } catch (error) {
          if (signal.aborted) return;
          if (!(error instanceof ApiError) || !error.retryable) {
            setConnection({ status: 'paused', error: errorMessage(error) });
            return;
          }
          failures += 1;
          setConnection({ status: 'retrying', error: `${errorMessage(error)} Повторное подключение…` });
          await delay(Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)), signal);
        }
      }
    }

    void listen();
    return () => controller.abort();
  }, [session, store, attempt]);

  return { ...connection, reconnect: () => setAttempt((value) => value + 1) };
}
