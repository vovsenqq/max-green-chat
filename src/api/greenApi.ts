import type { ChatApi, Credentials, GreenNotification } from '../types';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number = 0) {
    super(message);
    this.name = 'ApiError';
  }

  get retryable(): boolean { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

/** Only GREEN-API hosts are accepted: credentials must never be sent to an arbitrary URL. */
export function normalizeApiUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Укажите полный apiUrl из личного кабинета GREEN-API.'); }
  if (url.protocol !== 'https:' || !/(^|\.)green-api\.com$/.test(url.hostname)
    || url.username || url.password || url.search || url.hash || url.port
    || !/^\/(?:v3\/?)?$/.test(url.pathname)) {
    throw new Error('Нужен HTTPS-адрес GREEN-API без параметров, например https://3100.api.green-api.com.');
  }
  return url.href.replace(/\/$/, '');
}

export function createGreenApi(input: Credentials): ChatApi {
  const apiUrl = normalizeApiUrl(input.apiUrl);
  const idInstance = input.idInstance.trim();
  const token = input.apiTokenInstance.trim();
  if (!/^\d+$/.test(idInstance)) throw new Error('idInstance должен содержать только цифры.');
  if (!token || /\s/.test(token)) throw new Error('Укажите apiTokenInstance без пробелов.');

  async function request<T>(method: string, options: {
    httpMethod?: 'GET' | 'POST' | 'DELETE'; body?: unknown; signal?: AbortSignal; suffix?: string; query?: string;
  } = {}): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 45_000);
    try {
      const url = `${apiUrl}/waInstance${idInstance}/${method}/${encodeURIComponent(token)}${options.suffix ?? ''}${options.query ?? ''}`;
      const response = await fetch(url, {
        method: options.httpMethod ?? 'GET',
        headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) {
        // Do not surface raw response bodies: some API errors echo the request URL/token.
        const labels: Record<number, string> = {
          400: 'Проверьте параметры запроса и настройки инстанса. Для получения сообщений webhookUrl должен быть пустым.',
          401: 'Неверный idInstance или apiTokenInstance.',
          403: 'Нет доступа к инстансу. Проверьте токен, тариф и ограничения аккаунта.',
          404: 'Инстанс или адрес API не найден. Скопируйте apiUrl из личного кабинета.',
          429: 'Превышен лимит запросов. Подождите немного.',
          469: 'MAX временно ограничил поиск номеров. Повторите попытку позже.',
        };
        throw new ApiError(labels[response.status] ?? `GREEN-API недоступен (HTTP ${response.status}).`, response.status);
      }
      const text = await response.text();
      if (!text.trim()) return null as T;
      try { return JSON.parse(text) as T; } catch { throw new ApiError('GREEN-API вернул ответ в неизвестном формате.', 502); }
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
      if (error instanceof ApiError) throw error;
      throw new ApiError(timedOut
        ? 'Время ожидания ответа истекло.'
        : 'Не удалось подключиться к GREEN-API. Проверьте сеть, apiUrl и доступность запросов из браузера (CORS).');
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }

  return {
    async getState(signal) {
      const data = await request<{ stateInstance: string }>('getStateInstance', { signal });
      if (!data?.stateInstance) throw new ApiError('В ответе нет состояния инстанса.', 502);
      return data.stateInstance;
    },
    async resolvePhone(phone, signal) {
      const data = await request<{ exist?: boolean; chatId?: string; status?: boolean }>('checkAccount', {
        httpMethod: 'POST', body: { phoneNumber: Number(phone) }, signal,
      });
      if (data?.status === false) throw new ApiError('Не удалось проверить номер. Проверьте авторизацию и лимиты MAX.', 400);
      if (data?.exist === false) throw new ApiError('Аккаунт MAX с таким номером не найден или недоступен для поиска.', 400);
      if (!data?.exist || !data.chatId) throw new ApiError('GREEN-API не вернул идентификатор собеседника.', 502);
      return String(data.chatId);
    },
    async sendMessage(chatId, message, signal) {
      const data = await request<{ idMessage: string }>('sendMessage', {
        httpMethod: 'POST', body: { chatId, message }, signal,
      });
      if (!data?.idMessage) throw new ApiError('Не получен идентификатор отправленного сообщения.', 502);
      return String(data.idMessage);
    },
    async receiveNotification(signal) {
      const data = await request<GreenNotification | null>('receiveNotification', { signal, query: '?receiveTimeout=30' });
      if (data !== null && (!Number.isSafeInteger(data.receiptId) || !data.body?.typeWebhook)) {
        throw new ApiError('Неизвестный формат уведомления. Получение приостановлено.', 400);
      }
      return data;
    },
    async deleteNotification(receiptId, signal) {
      const data = await request<{ result: boolean }>('deleteNotification', {
        httpMethod: 'DELETE', suffix: `/${receiptId}`, signal,
      });
      if (!data?.result) throw new ApiError('Не удалось подтвердить обработку уведомления.', 502);
    },
  };
}
